"""Refresh encrypted application data without publishing private configuration or logs."""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
from pathlib import Path, PurePosixPath
import secrets
import shutil
import stat
import subprocess
import sys
import tempfile
import uuid
import zipfile

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

SCHEMA = 1
ALGORITHM = 'AES-256-GCM'
RUNTIME_PATH = Path('protected/runtime.enc.json')
DATA_PATH = Path('site/data/private.enc.json')
KEY_ENV = {'runtime': 'SPARNAH_RUNTIME_KEY', 'data': 'SPARNAH_DATA_KEY'}
KEY_NAMES = {'runtime': 'runtime.key', 'data': 'data.key'}
AAD_PREFIX = {'runtime': 'sparnah-runtime:v1:', 'data': 'sparnah-vault:v1:'}
MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
MAX_EXPANDED_BYTES = 96 * 1024 * 1024
MAX_FILES = 2048
REQUIRED = ('importer.py', 'frosta_groups.py', 'scripts/update_offers.py',
            'scripts/update_assortment.py', 'scripts/update_leaflets.py',
            'site/data/catalog.json', 'site/data/status.json',
            'site/data/assortment.json', 'site/data/leaflets.json')


class PipelineError(Exception):
    """Only a constant stage code is safe to expose in a public log."""
    def __init__(self, stage):
        self.stage = stage
        super().__init__(stage)


def b64encode(value):
    return base64.urlsafe_b64encode(value).decode('ascii').rstrip('=')


def b64decode(value):
    if not isinstance(value, str) or not value or any(c not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_' for c in value):
        raise PipelineError('encoding')
    try:
        return base64.b64decode(value + '=' * (-len(value) % 4), altchars=b'-_', validate=True)
    except Exception:
        raise PipelineError('encoding') from None


def validate_dataset_id(value):
    try:
        parsed = uuid.UUID(value)
        if str(parsed) != value or parsed.version != 4:
            raise ValueError()
    except (ValueError, TypeError, AttributeError):
        raise PipelineError('dataset-id') from None
    return value


def read_key(kind, file=None):
    try:
        value = Path(file).read_text(encoding='ascii').strip() if file else os.environ.get(KEY_ENV[kind], '').strip()
        key = b64decode(value)
        if len(key) != 32:
            raise ValueError()
        return key
    except Exception:
        raise PipelineError('key') from None


def generate_keys(directory):
    directory = Path(directory).resolve()
    if directory.is_relative_to(Path(__file__).resolve().parents[1]):
        raise PipelineError('key-location')
    directory.mkdir(parents=True, exist_ok=True)
    targets = [directory / name for name in KEY_NAMES.values()]
    if any(path.exists() for path in targets):
        raise PipelineError('key-exists')
    for path in targets:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='ascii') as out:
            out.write(b64encode(secrets.token_bytes(32)) + '\n')


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf8')


def encrypt_bytes(plain, key, dataset_id, kind):
    validate_dataset_id(dataset_id)
    if kind not in AAD_PREFIX or len(key) != 32:
        raise PipelineError('encryption')
    iv = secrets.token_bytes(12)
    cipher = AESGCM(key).encrypt(iv, plain, (AAD_PREFIX[kind] + dataset_id).encode('utf8'))
    return {'schemaVersion': SCHEMA, 'algorithm': ALGORITHM, 'datasetId': dataset_id,
            'iv': b64encode(iv), 'ciphertext': b64encode(cipher)}


def decrypt_bytes(envelope, key, kind):
    try:
        if kind not in AAD_PREFIX or set(envelope) != {'schemaVersion', 'algorithm', 'datasetId', 'iv', 'ciphertext'}:
            raise ValueError()
        if envelope['schemaVersion'] != SCHEMA or envelope['algorithm'] != ALGORITHM:
            raise ValueError()
        dataset = validate_dataset_id(envelope['datasetId'])
        iv, cipher = b64decode(envelope['iv']), b64decode(envelope['ciphertext'])
        if len(iv) != 12 or len(cipher) < 16 or len(cipher) > MAX_EXPANDED_BYTES:
            raise ValueError()
        return AESGCM(key).decrypt(iv, cipher, (AAD_PREFIX[kind] + dataset).encode('utf8'))
    except Exception:
        raise PipelineError('decryption') from None


def runtime_files(source):
    source = Path(source).resolve()
    files = [source / 'importer.py', source / 'frosta_groups.py']
    for folder in ('scripts', 'tests', 'site'):
        base = source / folder
        if not base.is_dir() or base.is_symlink():
            raise PipelineError('runtime-input')
        for path in base.rglob('*'):
            relative = path.relative_to(source)
            if path.is_symlink():
                raise PipelineError('runtime-input')
            if '__pycache__' in relative.parts or path.suffix in ('.pyc', '.pyo', '.tmp'):
                continue
            if path.is_file():
                files.append(path)
    if any(not (source / name).is_file() for name in REQUIRED) or any(path.is_symlink() for path in files):
        raise PipelineError('runtime-input')
    if len(files) > MAX_FILES or sum(path.stat().st_size for path in files) > MAX_EXPANDED_BYTES:
        raise PipelineError('runtime-size')
    return sorted(files)


def pack_runtime(source):
    source = Path(source).resolve()
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in runtime_files(source):
            info = zipfile.ZipInfo(path.relative_to(source).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o600) << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    result = output.getvalue()
    if len(result) > MAX_ARCHIVE_BYTES:
        raise PipelineError('runtime-size')
    return result


def extract_runtime(blob, destination):
    destination = Path(destination).resolve()
    if len(blob) > MAX_ARCHIVE_BYTES:
        raise PipelineError('archive-size')
    try:
        with zipfile.ZipFile(io.BytesIO(blob)) as archive:
            members = archive.infolist()
            names = [m.filename for m in members]
            if len(members) > MAX_FILES or len(names) != len(set(names)) or sum(m.file_size for m in members) > MAX_EXPANDED_BYTES:
                raise ValueError()
            for member in members:
                name = member.orig_filename
                path = PurePosixPath(name)
                mode = member.external_attr >> 16
                if (not name or name != member.filename or '\\' in name or '\x00' in name or ':' in name or path.is_absolute() or path.as_posix() != name
                        or '..' in path.parts or '.' in path.parts or member.is_dir()
                        or stat.S_ISLNK(mode) or stat.S_IFMT(mode) not in (0, stat.S_IFREG)
                        or member.flag_bits & 1):
                    raise ValueError()
                target = (destination / Path(*path.parts)).resolve()
                if not target.is_relative_to(destination):
                    raise ValueError()
                if path.parts[0] not in ('scripts', 'tests', 'site') and name not in ('importer.py', 'frosta_groups.py'):
                    raise ValueError()
            if any(name not in names for name in REQUIRED):
                raise ValueError()
            destination.mkdir(parents=True, exist_ok=True)
            if any(destination.iterdir()):
                raise ValueError()
            for member in members:
                target = destination / Path(*PurePosixPath(member.filename).parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as out:
                    out.write(archive.read(member))
    except Exception:
        raise PipelineError('archive') from None


def validate_payload(payload):
    try:
        if set(payload) != {'schemaVersion', 'catalog', 'assortment', 'leaflets', 'status'} or payload['schemaVersion'] != 1:
            raise ValueError()
        catalog, assortment, leaflets, status = [payload[k] for k in ('catalog', 'assortment', 'leaflets', 'status')]
        if catalog['version'] != 2 or any(not isinstance(catalog[k], list) for k in ('products', 'offers', 'stores')):
            raise ValueError()
        if assortment['version'] != 1 or not isinstance(assortment['products'], list) or not isinstance(assortment.get('sources'), dict):
            raise ValueError()
        if leaflets['version'] != 1 or not isinstance(leaflets['leaflets'], list) or not isinstance(status, dict):
            raise ValueError()
    except Exception:
        raise PipelineError('payload') from None
    return payload


def make_payload(source):
    source = Path(source)
    try:
        payload = {'schemaVersion': 1}
        for key in ('catalog', 'assortment', 'leaflets', 'status'):
            payload[key] = json.loads((source / 'site/data' / (key + '.json')).read_text(encoding='utf8'))
        return validate_payload(payload)
    except Exception:
        raise PipelineError('payload') from None


def assert_public_tree(root, payload, forbidden_values=()):
    """Private geographic values must not reappear in any clear public project file."""
    terms = set()
    catalog = payload['catalog']
    if isinstance(catalog.get('location'), str) and len(catalog['location']) >= 4:
        terms.add(catalog['location'].casefold())
    for store in catalog.get('stores', []):
        for field in ('address', 'city', 'postalCode', 'url', 'sourceUrl'):
            value = store.get(field)
            if isinstance(value, str) and len(value) >= 4:
                terms.add(value.casefold())
    for path in Path(root).rglob('*'):
        relative = path.relative_to(root)
        if '.git' in relative.parts or '__pycache__' in relative.parts or path.is_dir():
            continue
        if path.is_symlink():
            raise PipelineError('public-files')
        if relative in (RUNTIME_PATH, DATA_PATH) or path.suffix.lower() in ('.png', '.pyc'):
            continue
        if path.suffix.lower() not in ('.js', '.cjs', '.py', '.json', '.html', '.css', '.svg', '.md', '.txt', '.yml', '.yaml', '.webmanifest'):
            continue
        content = path.read_text(encoding='utf8').casefold()
        if any(term in content or term in relative.as_posix().casefold() for term in terms):
            raise PipelineError('public-content')
        if any(value.casefold() in content for value in forbidden_values):
            raise PipelineError('public-secret')
    # Only the encrypted payload may live in the public data directory.
    data_dir = Path(root) / 'site/data'
    if data_dir.exists() and any(p.is_file() and p.name != DATA_PATH.name for p in data_dir.rglob('*')):
        raise PipelineError('public-data')


def atomic_write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix='.encrypted-', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(value)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temp, path)
    finally:
        Path(temp).unlink(missing_ok=True)


def publish_envelopes(root, runtime, data):
    root = Path(root).resolve()
    paths = (root / RUNTIME_PATH, root / DATA_PATH)
    previous = [path.read_bytes() if path.exists() else None for path in paths]
    try:
        for path, value in zip(paths, (runtime, data)):
            atomic_write(path, json_bytes(value))
    except Exception:
        for path, value in zip(paths, previous):
            if value is None:
                path.unlink(missing_ok=True)
            else:
                atomic_write(path, value)
        raise PipelineError('publish') from None


def prepare_envelopes(source, root, dataset_id, runtime_key, data_key):
    if runtime_key == data_key:
        raise PipelineError('separate-keys')
    payload = make_payload(source)
    assert_public_tree(root, payload, (b64encode(runtime_key), b64encode(data_key), runtime_key.hex(), data_key.hex()))
    archive = pack_runtime(source)
    plain = json_bytes(payload)
    runtime = encrypt_bytes(archive, runtime_key, dataset_id, 'runtime')
    data = encrypt_bytes(plain, data_key, dataset_id, 'data')
    if decrypt_bytes(runtime, runtime_key, 'runtime') != archive or decrypt_bytes(data, data_key, 'data') != plain:
        raise PipelineError('roundtrip')
    validate_payload(json.loads(decrypt_bytes(data, data_key, 'data')))
    return runtime, data


def pack(source, root, dataset_id, runtime_key, data_key):
    runtime, data = prepare_envelopes(source, root, dataset_id, runtime_key, data_key)
    publish_envelopes(root, runtime, data)


def run_private(source, log_path):
    source = Path(source)
    child_env = dict(os.environ)
    for name in (*KEY_ENV.values(), 'GITHUB_TOKEN', 'GH_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN'):
        child_env.pop(name, None)
    child_env.update(PYTHONUTF8='1', PYTHONDONTWRITEBYTECODE='1')
    child_env.update(TMPDIR=str(source.parent), TEMP=str(source.parent), TMP=str(source.parent))
    js_tests = [str(path.relative_to(source)) for path in sorted((source / 'tests').glob('*.test.cjs'))]
    if not js_tests:
        raise PipelineError('tests-missing')
    commands = [
        ('tests-before-js', ['node', '--test', *js_tests]),
        ('tests-before-python', [sys.executable, '-X', 'utf8', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py']),
        ('refresh-assortment', [sys.executable, '-X', 'utf8', 'scripts/update_assortment.py']),
        ('refresh-offers', [sys.executable, '-X', 'utf8', 'scripts/update_offers.py']),
        ('refresh-leaflets', [sys.executable, '-X', 'utf8', 'scripts/update_leaflets.py', '--output', 'site/data/leaflets.json']),
        ('tests-after-js', ['node', '--test', *js_tests]),
        ('tests-after-python', [sys.executable, '-X', 'utf8', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py']),
    ]
    with Path(log_path).open('wb') as log:
        for stage, command in commands:
            try:
                result = subprocess.run(command, cwd=source, env=child_env, stdin=subprocess.DEVNULL,
                                        stdout=log, stderr=subprocess.STDOUT, timeout=660, check=False)
                if result.returncode != 0:
                    raise ValueError()
            except Exception:
                raise PipelineError(stage) from None


def refresh(root, runtime_key, data_key):
    root = Path(root).resolve()
    try:
        envelope = json.loads((root / RUNTIME_PATH).read_text(encoding='utf8'))
        current_data = json.loads((root / DATA_PATH).read_text(encoding='utf8'))
        if current_data.get('datasetId') != envelope.get('datasetId'):
            raise ValueError()
        archive = decrypt_bytes(envelope, runtime_key, 'runtime')
        validate_payload(json.loads(decrypt_bytes(current_data, data_key, 'data')))
    except Exception:
        raise PipelineError('open-runtime') from None
    # TemporaryDirectory's cleanup runs for parser failures, test failures and interrupted stages.
    with tempfile.TemporaryDirectory(prefix='sparnah-private-', dir=os.environ.get('RUNNER_TEMP') or None) as temp:
        source = Path(temp) / 'runtime'
        extract_runtime(archive, source)
        run_private(source, Path(temp) / 'private.log')
        runtime, data = prepare_envelopes(source, root, envelope['datasetId'], runtime_key, data_key)
    publish_envelopes(root, runtime, data)


def unpack(root, destination, runtime_key):
    root, destination = Path(root).resolve(), Path(destination).resolve()
    if destination.exists() or destination.is_relative_to(root):
        raise PipelineError('unpack-destination')
    try:
        envelope = json.loads((root / RUNTIME_PATH).read_text(encoding='utf8'))
        archive = decrypt_bytes(envelope, runtime_key, 'runtime')
        extract_runtime(archive, destination)
    except Exception:
        # This path was verified not to exist and to lie outside the public repository.
        if destination.exists():
            shutil.rmtree(destination)
        raise PipelineError('unpack') from None


def main(argv=None):
    parser = argparse.ArgumentParser(description='Maintain encrypted application data.')
    sub = parser.add_subparsers(dest='command', required=True)
    generate = sub.add_parser('generate-keys')
    generate.add_argument('--directory', required=True)
    for command in ('pack', 'refresh', 'unpack'):
        command_parser = sub.add_parser(command)
        command_parser.add_argument('--root', default=str(Path(__file__).resolve().parents[1]))
        command_parser.add_argument('--runtime-key-file')
        if command != 'unpack':
            command_parser.add_argument('--data-key-file')
        if command == 'pack':
            command_parser.add_argument('--source', required=True)
            command_parser.add_argument('--dataset-id', required=True)
        elif command == 'unpack':
            command_parser.add_argument('--destination', required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == 'generate-keys':
            generate_keys(args.directory)
        else:
            for name in ('runtime_key_file', 'data_key_file'):
                key_file = getattr(args, name, None)
                if key_file and Path(key_file).resolve().is_relative_to(Path(args.root).resolve()):
                    raise PipelineError('key-location')
            runtime_key = read_key('runtime', args.runtime_key_file)
            if args.command == 'unpack':
                unpack(args.root, args.destination, runtime_key)
            else:
                data_key = read_key('data', args.data_key_file)
                if args.command == 'pack':
                    pack(args.source, args.root, args.dataset_id, runtime_key, data_key)
                else:
                    refresh(args.root, runtime_key, data_key)
        print('Private data operation completed.')
        return 0
    except PipelineError as error:
        print('Private data operation failed (' + error.stage + ').', file=sys.stderr)
        return 1
    except BaseException:
        print('Private data operation failed (internal).', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
