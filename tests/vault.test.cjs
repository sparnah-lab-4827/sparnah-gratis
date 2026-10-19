const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {gzipSync}=require('node:zlib');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const V=require('../site/vault.js');
const encode=b=>Buffer.from(b).toString('base64url');
const bundle=()=>({schemaVersion:1,catalog:{version:2,stores:[{id:'market',name:'Private market'}],products:[],offers:[]},assortment:{version:1,products:[],sources:{}},leaflets:{version:1,leaflets:[],sources:[]},status:{lastAttemptAt:'2026-10-19'}});
async function encrypted(data=bundle(),options={}){
  const raw=webcrypto.getRandomValues(new Uint8Array(32));
  const access={format:'sparnah-access-v1',datasetId:'test-dataset',key:encode(raw)};
  const iv=webcrypto.getRandomValues(new Uint8Array(12));
  const key=await webcrypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt']);
  const plaintext=new TextEncoder().encode(JSON.stringify(data));
  const ciphertext=await webcrypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(options.aad||'sparnah-vault:v1:'+access.datasetId),tagLength:128},key,options.compression==='gzip'?gzipSync(plaintext):plaintext);
  return {access,envelope:{schemaVersion:1,algorithm:'AES-256-GCM',datasetId:access.datasetId,iv:encode(iv),ciphertext:encode(ciphertext),...(options.compression?{compression:options.compression}:{})}};
}
function setup(fixture,initial={}){
  const values=new Map(Object.entries(initial)),writes=[],cached=new Map(),received=[];
  let fail=false,fetches=0,starts=0,clock=1000000;
  const storage={getItem:key=>values.get(key)||null,setItem(key,value){writes.push(key);values.set(key,value);},removeItem(key){writes.push(key);values.delete(key);}};
  const vault=V.createVault({storage,crypto:webcrypto,now:()=>clock,cache:{async get(id){return cached.get(id)},async put(id,value){cached.set(id,structuredClone(value));}},async fetchEnvelope(){fetches++;received.push(V.DATA_URL);if(fail)throw Error('unreachable');return fixture.envelope;},onUnlock(){starts++;}});
  return {vault,values,writes,cached,received,get fetches(){return fetches},get starts(){return starts},offline(){fail=true},advance(){clock+=600001}};
}
test('decrypts real AES-256-GCM with the exact Python-compatible AAD and concatenated tag',async()=>{
  const {access,envelope}=await encrypted();assert.deepEqual(await V.decryptEnvelope(envelope,access,webcrypto),bundle());
});
test('decrypts gzip using the real DecompressionStream and retains legacy compatibility',async()=>{
  assert.equal(typeof DecompressionStream,'function');
  for(const compression of [undefined,'gzip']){
    const {access,envelope}=await encrypted(bundle(),{compression});assert.deepEqual(await V.decryptEnvelope(envelope,access,webcrypto),bundle());
  }
});
test('rejects unknown compression and authenticated bytes that are not valid gzip',async()=>{
  const {access,envelope}=await encrypted();
  for(const compression of ['brotli','none',null,'gzip'])await assert.rejects(V.decryptEnvelope({...envelope,compression},access,webcrypto));
});
test('gzip output is stopped at the 40 MiB decoded size limit',async()=>{
  const data=bundle();data.oversized='x'.repeat(40*1024*1024);
  const {access,envelope}=await encrypted(data,{compression:'gzip'});
  await assert.rejects(V.decryptEnvelope(envelope,access,webcrypto));
});
test('rejects wrong keys, wrong dataset, altered IV, ciphertext and authenticated metadata',async()=>{
  const {access,envelope}=await encrypted();
  const other=(await encrypted()).access;
  await assert.rejects(V.decryptEnvelope(envelope,other,webcrypto));
  await assert.rejects(V.decryptEnvelope({...envelope,datasetId:'other'},access,webcrypto));
  const changed=Buffer.from(envelope.ciphertext,'base64url');changed[0]^=1;
  await assert.rejects(V.decryptEnvelope({...envelope,ciphertext:encode(changed)},access,webcrypto));
  const iv=Buffer.from(envelope.iv,'base64url');iv[0]^=1;
  await assert.rejects(V.decryptEnvelope({...envelope,iv:encode(iv)},access,webcrypto));
  const bad=await encrypted(bundle(),{aad:'wrong-context'});
  await assert.rejects(V.decryptEnvelope(bad.envelope,bad.access,webcrypto));
});
test('strict access and decrypted schema validation rejects arbitrary files',async()=>{
  const {access}=await encrypted();
  for(const bad of ['not-json',JSON.stringify({state:{items:[]}}),{...access,key:'x'.repeat(43)},{...access,datasetId:'../place'}, {...access,format:'unknown'},'x'.repeat(5000)]){
    if(typeof bad==='object'&&bad.key==='x'.repeat(43))continue; // correctly-sized random keys are rejected by authentication, not syntax
    assert.throws(()=>V.parseAccess(bad));
  }
  const fixture=await encrypted({schemaVersion:1,catalog:{}});await assert.rejects(V.decryptEnvelope(fixture.envelope,fixture.access,webcrypto));
});
test('locked restore never starts the app, fetches data or touches existing personal state',async()=>{
  const personal=JSON.stringify({base:{items:[{id:'own'}],settings:{enabledStores:['market']}},photos:false});
  const s=setup(await encrypted(),{'sparnah-v1':personal,'sparnah-public-catalog-gratis-v3':'legacy private cache'});
  assert.equal(await s.vault.restore(),false);assert.equal(s.fetches,0);assert.equal(s.starts,0);assert.equal(s.vault.getData(),null);assert.deepEqual(s.writes,[]);assert.equal(s.values.get('sparnah-v1'),personal);
});
test('successful unlock stores only the access file and ciphertext; no private list mutation',async()=>{
  const fixture=await encrypted(),s=setup(fixture,{'sparnah-v1':'unchanged'});
  await s.vault.unlock(fixture.access);
  assert.equal(s.starts,1);assert.deepEqual(s.vault.getData(),bundle());assert.equal(s.values.get('sparnah-v1'),'unchanged');assert.deepEqual(s.writes,[V.ACCESS_KEY]);
  assert.deepEqual(s.cached.get('test-dataset'),fixture.envelope);assert.equal(JSON.stringify([...s.cached.values()]).includes('Private market'),false);
  assert.deepEqual(s.received,['data/private.enc.json']);assert.deepEqual(JSON.parse(s.vault.exportAccess()),fixture.access);
  await s.vault.refresh(true);await s.vault.unlock(fixture.access);assert.equal(s.starts,1);
});
test('wrong key never replaces a saved key or starts the app',async()=>{
  const fixture=await encrypted(),s=setup(fixture,{[V.ACCESS_KEY]:'preserved','sparnah-v1':'list'});
  await assert.rejects(s.vault.unlock((await encrypted()).access));
  assert.equal(s.values.get(V.ACCESS_KEY),'preserved');assert.equal(s.values.get('sparnah-v1'),'list');assert.equal(s.starts,0);assert.equal(s.cached.size,0);
});
test('restores with saved access and decrypts cached ciphertext offline; expired dates stay unchanged',async()=>{
  const fixture=await encrypted(),s=setup(fixture,{[V.ACCESS_KEY]:JSON.stringify(fixture.access)});
  s.cached.set('test-dataset',fixture.envelope);s.offline();
  assert.equal(await s.vault.restore(),true);assert.equal(s.vault.getStatus().offline,true);assert.equal(s.vault.getData().status.lastAttemptAt,'2026-10-19');assert.equal(s.starts,1);
});
test('offline first unlock fails safely when no authenticated ciphertext exists',async()=>{
  const fixture=await encrypted(),s=setup(fixture);s.offline();await assert.rejects(s.vault.unlock(fixture.access));assert.equal(s.starts,0);assert.equal(s.values.has(V.ACCESS_KEY),false);
});
test('refresh is shared, throttled and never replaces good data/cache with tampering',async()=>{
  const fixture=await encrypted(),s=setup(fixture);await s.vault.unlock(fixture.access);
  await s.vault.refresh();assert.equal(s.fetches,1);s.advance();
  const one=s.vault.refresh(),two=s.vault.refresh();assert.equal(one,two);await one;assert.equal(s.fetches,2);
  const previous=s.vault.getData(),cached=s.cached.get('test-dataset');fixture.envelope={...fixture.envelope,ciphertext:'A'.repeat(32)};
  assert.equal((await s.vault.refresh(true)).offline,true);assert.deepEqual(s.vault.getData(),previous);assert.deepEqual(s.cached.get('test-dataset'),cached);assert.match(s.vault.getStatus().error,/nicht aktualisiert/);
});
test('a damaged remote update restores the authenticated cache, but a wrong key cannot use it',async()=>{
  const fixture=await encrypted(),s=setup(fixture,{[V.ACCESS_KEY]:JSON.stringify(fixture.access)});
  s.cached.set('test-dataset',fixture.envelope);fixture.envelope={schemaVersion:99};
  assert.equal(await s.vault.restore(),true);assert.deepEqual(s.vault.getData(),bundle());assert.equal(s.vault.getStatus().offline,true);
  const wrong=(await encrypted()).access;await assert.rejects(s.vault.unlock(wrong));assert.deepEqual(JSON.parse(s.values.get(V.ACCESS_KEY)),fixture.access);
});
test('failed script loading can retry and concurrent activations start the app once',async()=>{
  const fixture=await encrypted();let attempts=0,release;
  const vault=V.createVault({crypto:webcrypto,storage:{setItem(){}},cache:{async put(){},async get(){}},async fetchEnvelope(){return fixture.envelope},async onUnlock(){attempts++;if(attempts===1)throw Error('load failed');await new Promise(resolve=>{release=resolve});}});
  await assert.rejects(vault.unlock(fixture.access));
  const retry=vault.unlock(fixture.access);while(!release)await new Promise(resolve=>setImmediate(resolve));
  const simultaneous=vault.unlock(fixture.access);await new Promise(resolve=>setTimeout(resolve,5));release();await Promise.all([retry,simultaneous]);
  assert.equal(attempts,2);await vault.unlock(fixture.access);assert.equal(attempts,2);
});
test('locking removes only access, hides decrypted data, retains list and encrypted offline copy',async()=>{
  const fixture=await encrypted(),s=setup(fixture,{'sparnah-v1':'list','legacy':'keep'});await s.vault.unlock(fixture.access);s.vault.lock();
  assert.equal(s.vault.getData(),null);assert.equal(s.values.has(V.ACCESS_KEY),false);assert.equal(s.values.get('sparnah-v1'),'list');assert.equal(s.values.get('legacy'),'keep');assert.equal(s.cached.size,1);
  assert.throws(()=>s.vault.exportAccess());await assert.rejects(s.vault.refresh());
});
test('a lock during decryption prevents late unlock and key persistence',async()=>{
  const fixture=await encrypted(),s=setup(fixture);const pending=s.vault.unlock(fixture.access);s.vault.lock();await assert.rejects(pending);assert.equal(s.starts,0);assert.equal(s.vault.getData(),null);assert.equal(s.values.has(V.ACCESS_KEY),false);
});
test('mobile activation fragment is consumed immediately, including malformed fragments',async()=>{
  const {access}=await encrypted(),calls=[];
  const win={location:{hash:'#access='+encode(JSON.stringify(access)),pathname:'/app/',search:'?v=test'},history:{replaceState(...args){calls.push(args)}}};
  assert.deepEqual(V.takeFragment(win),access);assert.deepEqual(calls,[[null,'','/app/?v=test']]);
  win.location.hash='#access=invalid!';assert.throws(()=>V.takeFragment(win));assert.equal(calls.length,2);
});
test('app.js returns before any user storage or UI reads while locked',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
  vm.runInNewContext(code,{window:{SparnahVault:{getData:()=>null}},get localStorage(){throw Error('personal storage read while locked')},get document(){throw Error('private UI touched while locked')}});
});
test('public HTML gates app loading and service worker caches only an explicit shell allowlist',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../site/index.html'),'utf8'),app=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8'),sw=fs.readFileSync(path.join(__dirname,'../site/sw.js'),'utf8');
  assert.match(html,/<body class="vault-locked">/);assert.match(html,/src="vault\.js/);assert.doesNotMatch(html,/<script[^>]+src="(?:catalog|app)\.js/);assert.doesNotMatch(html,/<img\b/);
  assert.doesNotMatch(app,/fetch\(|CATALOG_CACHE_KEY|localStorage\.getItem\('sparnah-public/);
  assert.match(sw,/!FILES\.includes\(path\)/);assert.doesNotMatch(sw,/data\/catalog\.json|data\/assortment\.json|catalog\.js/);
  const backup=app.slice(app.indexOf('  function backup()'),app.indexOf('  async function importBackup'));
  assert.doesNotMatch(backup,/exportAccess|ACCESS_KEY|datasetId|\.key/);
});
