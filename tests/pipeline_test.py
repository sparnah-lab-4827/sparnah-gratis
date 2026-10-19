"""Generic encryption and isolation tests; no production data or keys are fixtures."""
import base64
import contextlib
import io
import json
import os
from pathlib import Path
import secrets
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid
import warnings
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import private_pipeline as P


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.source = self.base / 'private'
        self.public = self.base / 'public'
        self.public.mkdir()
        self.dataset = str(uuid.uuid4())
        self.runtime_key, self.data_key = secrets.token_bytes(32), secrets.token_bytes(32)
        self.payload = {'schemaVersion': 1,
                        'catalog': {'version': 2, 'stores': [], 'products': [], 'offers': []},
                        'assortment': {'version': 1, 'products': [], 'sources': {}},
                        'leaflets': {'version': 1, 'leaflets': []}, 'status': {}}
        for name in P.REQUIRED:
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('# Private placeholder\n', encoding='utf8')
        (self.source / 'tests').mkdir()
        (self.source / 'tests/check.test.cjs').write_text('// placeholder\n', encoding='utf8')
        self.write_payload()

    def write_payload(self):
        for name in ('catalog', 'assortment', 'leaflets', 'status'):
            (self.source / 'site/data' / (name + '.json')).write_bytes(P.json_bytes(self.payload[name]))

    def initial_pack(self):
        P.pack(self.source, self.public, self.dataset, self.runtime_key, self.data_key)

    def make_zip(self, extras=()):
        raw = io.BytesIO()
        with zipfile.ZipFile(raw, 'w') as archive:
            for name in P.REQUIRED:
                archive.writestr(name, '{}')
            for name, value in extras:
                with warnings.catch_warnings():
                    warnings.simplefilter('ignore',UserWarning)
                    archive.writestr(name, value)
        result=raw.getvalue()
        # ZipInfo normalizes the platform separator when constructed on Windows.
        for name,_ in extras:
            if isinstance(name,str) and '\\' in name:
                result=result.replace(name.replace('\\','/').encode(),name.encode())
        return result

    def test_roundtrip_uses_browser_compatible_envelope_and_fresh_iv(self):
        plain = P.json_bytes(self.payload)
        first = P.encrypt_bytes(plain, self.data_key, self.dataset, 'data')
        second = P.encrypt_bytes(plain, self.data_key, self.dataset, 'data')
        self.assertEqual(set(first), {'schemaVersion', 'algorithm', 'datasetId', 'iv', 'ciphertext'})
        self.assertEqual(first['algorithm'], 'AES-256-GCM')
        self.assertEqual(len(P.b64decode(first['iv'])), 12)
        self.assertEqual(len(P.b64decode(first['ciphertext'])), len(plain) + 16)
        self.assertNotEqual(first['iv'], second['iv'])
        self.assertEqual(P.decrypt_bytes(first, self.data_key, 'data'), plain)
        self.assertEqual(first['datasetId'], self.dataset)

    def test_node_webcrypto_decrypts_exact_python_browser_format(self):
        envelope = P.encrypt_bytes(P.json_bytes(self.payload), self.data_key, self.dataset, 'data')
        code = """const {webcrypto}=require('node:crypto');let input='';
process.stdin.on('data',x=>input+=x);process.stdin.on('end',async()=>{
 const {envelope:e,key:k}=JSON.parse(input);
 const key=await webcrypto.subtle.importKey('raw',Buffer.from(k,'base64url'),{name:'AES-GCM'},false,['decrypt']);
 const plain=await webcrypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(e.iv,'base64url'),additionalData:Buffer.from('sparnah-vault:v1:'+e.datasetId),tagLength:128},key,Buffer.from(e.ciphertext,'base64url'));
 process.stdout.write(Buffer.from(plain));});"""
        result = subprocess.run(['node', '-e', code], input=json.dumps({'envelope': envelope, 'key': P.b64encode(self.data_key)}),
                                text=True, capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout), self.payload)

    def test_wrong_key_wrong_purpose_tampering_and_rebound_dataset_fail(self):
        envelope = P.encrypt_bytes(b'private-data', self.data_key, self.dataset, 'data')
        altered = dict(envelope)
        cipher = bytearray(P.b64decode(altered['ciphertext']));cipher[0] ^= 1
        altered['ciphertext'] = P.b64encode(cipher)
        for blob, key, kind in [(envelope, self.runtime_key, 'data'), (envelope, self.data_key, 'runtime'),
                                (altered, self.data_key, 'data'), ({**envelope, 'datasetId': str(uuid.uuid4())}, self.data_key, 'data')]:
            with self.assertRaises(P.PipelineError):
                P.decrypt_bytes(blob, key, kind)

    def test_key_generation_is_random_and_never_overwrites(self):
        directory = self.base / 'keys'
        P.generate_keys(directory)
        first = P.read_key('runtime', directory / 'runtime.key')
        second = P.read_key('data', directory / 'data.key')
        self.assertEqual(len(first), 32);self.assertNotEqual(first, second)
        with self.assertRaises(P.PipelineError):P.generate_keys(directory)
        self.assertEqual(P.read_key('runtime', directory / 'runtime.key'), first)
        with patch.dict(os.environ, {'SPARNAH_DATA_KEY': ''}),self.assertRaises(P.PipelineError):P.read_key('data')

    def test_pack_roundtrip_contains_required_files_but_no_repository_metadata(self):
        (self.source / '.git').mkdir();(self.source / '.git/config').write_text('private metadata')
        self.initial_pack()
        runtime = json.loads((self.public / P.RUNTIME_PATH).read_text())
        archive = P.decrypt_bytes(runtime, self.runtime_key, 'runtime')
        destination = self.base / 'extracted'
        P.extract_runtime(archive, destination)
        self.assertTrue((destination / 'scripts/update_offers.py').exists())
        self.assertFalse((destination / '.git').exists())
        data = json.loads((self.public / P.DATA_PATH).read_text())
        self.assertEqual(json.loads(P.decrypt_bytes(data, self.data_key, 'data')), self.payload)
        self.assertEqual(data['datasetId'], runtime['datasetId'])

    def test_archive_rejects_escape_paths_aliases_symlinks_and_duplicate_members(self):
        malicious = [('../outside.txt', b'x'), ('/outside.txt', b'x'), ('C:/outside.txt', b'x'),
                     ('site\\outside.txt', b'x'), ('site/./outside.txt', b'x'), ('site//outside.txt', b'x'),
                     ('.git/config', b'x'), ('importer.py', b'duplicate')]
        symlink = zipfile.ZipInfo('site/link');symlink.external_attr=(stat.S_IFLNK | 0o777) << 16
        malicious.append((symlink, b'../../outside.txt'))
        for entry in malicious:
            with self.subTest(name=str(entry[0])),self.assertRaises(P.PipelineError):
                P.extract_runtime(self.make_zip([entry]), self.base / 'unsafe')
        self.assertFalse((self.base / 'outside.txt').exists())

    def test_archive_enforces_size_limits_and_refuses_nonempty_destination(self):
        archive = self.make_zip()
        with patch.object(P, 'MAX_ARCHIVE_BYTES', 1),self.assertRaises(P.PipelineError):
            P.extract_runtime(archive, self.base / 'out')
        with patch.object(P, 'MAX_EXPANDED_BYTES', 1),self.assertRaises(P.PipelineError):
            P.extract_runtime(archive, self.base / 'out')
        destination = self.base / 'used';destination.mkdir();(destination / 'keep').write_text('keep')
        with self.assertRaises(P.PipelineError):P.extract_runtime(archive, destination)
        self.assertEqual((destination / 'keep').read_text(), 'keep')

    def test_plain_public_geographic_values_or_unencrypted_data_block_pack(self):
        self.payload['catalog']['stores'] = [{'city': 'Example Private City', 'postalCode': '54321'}]
        self.write_payload()
        (self.public / 'README.md').write_text('Example Private City', encoding='utf8')
        with self.assertRaises(P.PipelineError):self.initial_pack()
        (self.public / 'README.md').write_text('Neutral app', encoding='utf8')
        (self.public / 'site/data').mkdir(parents=True)
        (self.public / 'site/data/catalog.json').write_text('{}')
        with self.assertRaises(P.PipelineError):self.initial_pack()
        self.assertFalse((self.public / P.RUNTIME_PATH).exists())

    def test_private_commands_run_before_and_after_refresh_and_never_receive_keys(self):
        seen=[]
        def fake_run(command, **kwargs):
            seen.append(command)
            self.assertNotIn('SPARNAH_RUNTIME_KEY', kwargs['env'])
            self.assertNotIn('SPARNAH_DATA_KEY', kwargs['env'])
            self.assertNotIn('GITHUB_TOKEN', kwargs['env'])
            self.assertEqual(kwargs['stderr'], subprocess.STDOUT)
            self.assertFalse(kwargs['stdout'].closed)
            self.assertEqual(kwargs['cwd'], self.source)
            return subprocess.CompletedProcess(command, 0)
        with patch.dict(os.environ, {'SPARNAH_RUNTIME_KEY': 'secret-a', 'SPARNAH_DATA_KEY': 'secret-b', 'GITHUB_TOKEN': 'secret-c'}),\
             patch.object(P.subprocess, 'run', side_effect=fake_run):
            P.run_private(self.source, self.base / 'private.log')
        self.assertEqual(len(seen), 7)
        self.assertIn('scripts/update_assortment.py', seen[2])
        self.assertIn('scripts/update_offers.py', seen[3])
        self.assertIn('scripts/update_leaflets.py', seen[4])
        self.assertEqual(seen[0], seen[-2]);self.assertEqual(seen[1], seen[-1])

    def test_failed_refresh_keeps_encrypted_state_and_removes_private_temporary_files(self):
        self.initial_pack()
        before = {path: (self.public / path).read_bytes() for path in (P.RUNTIME_PATH, P.DATA_PATH)}
        runner = self.base / 'runner';runner.mkdir()
        with patch.dict(os.environ, {'RUNNER_TEMP': str(runner)}),\
             patch.object(P, 'run_private', side_effect=P.PipelineError('tests-before-js')):
            with self.assertRaises(P.PipelineError):P.refresh(self.public, self.runtime_key, self.data_key)
        self.assertEqual(list(runner.iterdir()), [])
        for path, value in before.items():self.assertEqual((self.public / path).read_bytes(), value)

    def test_successful_refresh_reencrypts_latest_data_and_preserves_dataset_identity(self):
        self.initial_pack()
        def fake_refresh(source, log):
            path = source / 'site/data/status.json'
            path.write_text('{"state":"fresh-test"}')
        with patch.object(P, 'run_private', side_effect=fake_refresh):
            P.refresh(self.public, self.runtime_key, self.data_key)
        data = json.loads((self.public / P.DATA_PATH).read_text())
        self.assertEqual(data['datasetId'], self.dataset)
        self.assertEqual(json.loads(P.decrypt_bytes(data, self.data_key, 'data'))['status']['state'], 'fresh-test')
        destination = self.base / 'latest'
        P.unpack(self.public, destination, self.runtime_key)
        self.assertEqual(json.loads((destination / 'site/data/status.json').read_text())['state'], 'fresh-test')

    def test_unpack_requires_new_destination_outside_public_repository(self):
        self.initial_pack()
        for target in (self.public / 'decrypted', self.source):
            with self.assertRaises(P.PipelineError):P.unpack(self.public, target, self.runtime_key)
        destination=self.base / 'edit-copy'
        P.unpack(self.public, destination, self.runtime_key)
        self.assertTrue((destination / 'importer.py').exists())
        with self.assertRaises(P.PipelineError):P.unpack(self.public, destination, self.runtime_key)

    def test_cli_error_message_never_contains_private_exception_or_input(self):
        output=io.StringIO()
        with contextlib.redirect_stderr(output),patch.object(P, 'read_key', side_effect=RuntimeError('PRIVATE_SECRET_AND_ADDRESS')):
            code=P.main(['refresh','--root',str(self.public)])
        self.assertEqual(code,1)
        self.assertNotIn('PRIVATE_SECRET_AND_ADDRESS',output.getvalue())
        self.assertNotIn(str(self.public),output.getvalue())
        self.assertNotIn('Traceback',output.getvalue())

    def test_separate_keys_and_nonidentifying_dataset_id_are_enforced(self):
        with self.assertRaises(P.PipelineError):P.pack(self.source,self.public,self.dataset,self.data_key,self.data_key)
        with self.assertRaises(P.PipelineError):P.encrypt_bytes(b'{}',self.data_key,'arbitrary-place-name','data')

    def test_key_files_and_accidentally_embedded_keys_cannot_be_published(self):
        (self.public / 'app.js').write_text('const badKey="' + P.b64encode(self.data_key) + '";')
        with self.assertRaises(P.PipelineError):self.initial_pack()
        output=io.StringIO()
        with contextlib.redirect_stderr(output):
            code=P.main(['refresh','--root',str(self.public),'--runtime-key-file',str(self.public / 'runtime.key')])
        self.assertEqual(code,1);self.assertIn('key-location',output.getvalue())
        self.assertNotIn(str(self.public),output.getvalue())


if __name__ == '__main__':
    unittest.main()
