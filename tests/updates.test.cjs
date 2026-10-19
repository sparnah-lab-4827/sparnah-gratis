const {test}=require('node:test'),assert=require('node:assert/strict');
const U=require('../site/updates.js'),L=require('../site/leaflets.js'),E=require('../site/engine.js');
test('market summary ignores excluded failures and deduplicates shared price records',()=>{
 const catalog={stores:[{id:'a'},{id:'b'},{id:'c',retailerId:'aldi'}],offers:[{id:'one',storeId:'a',applicableStoreIds:['a','c']},{id:'two',storeId:'b'}]};
 const status={stores:{a:{state:'ok'},b:{state:'error'},aldi:{state:'ok'}},normalPrices:{state:'error'}};
 const a=U.scope(catalog,status,['a']);assert.equal(a.failures,0);assert.equal(a.prices.length,1);assert.deepEqual(a.stores.map(s=>s.id),['a']);
 assert.equal(U.scope(catalog,status,['a','c']).prices.length,1);assert.equal(U.scope(catalog,status,['c']).failures,1);
 assert.equal(U.scope(catalog,status,['b']).failures,1);assert.equal(U.scope(catalog,status,[]).prices.length,0);assert.equal(U.scope(catalog,status,[]).failures,0);
});
test('resume and reconnect force a published-data check; hidden or empty selection does not',async()=>{
 const handlers={},docHandlers={},calls=[];let selected=['a'],finish,resumes=0,timer;
 const win={document:{visibilityState:'visible',addEventListener:(n,fn)=>docHandlers[n]=fn},addEventListener:(n,fn)=>handlers[n]=fn,setInterval:fn=>{timer=fn;}};
 const u=U.bind(win,{enabled:()=>selected,onResume:()=>resumes++,refresh:force=>{calls.push(force);return new Promise(r=>finish=r);}});
 docHandlers.visibilitychange();handlers.online();await Promise.resolve();assert.deepEqual(calls,[true]);
 finish(true);await u.check();
 win.document.visibilityState='hidden';handlers.online();docHandlers.visibilitychange();await u.check();assert.equal(calls.length,1);
 win.document.visibilityState='visible';handlers.pageshow({persisted:true});await Promise.resolve();assert.deepEqual(calls,[true,true]);finish(true);await u.check();
 selected=[];await u.selectionChanged();handlers.online();await u.check();assert.equal(calls.length,2);
 selected=['b'];const changed=u.selectionChanged();await Promise.resolve();assert.equal(calls.length,3);finish(true);await changed;
 await u.selectionChanged();assert.equal(calls.length,3);timer();await Promise.resolve();assert.equal(calls.at(-1),false);finish(true);await u.check();assert.equal(resumes,2);
});
test('new leaflets only show for selected markets, with original expiry and proof required',()=>{
 const stores=[{id:'a',name:'A',retailerId:'r'},{id:'b',name:'B',retailerId:'r'},{id:'c',name:'C'}];
 const entry={storeId:'a',retailerId:'r',scopeType:'national',start:'2026-10-19',end:'2026-10-24',checkedAt:'2026-10-19',dateProof:'visible date',viewerUrl:'https://example.org/leaflet'};
 const data={leaflets:[entry,{...entry,storeId:'c',scopeType:'store'}, {...entry,end:'2026-10-18'}, {...entry,dateProof:null}]};
 const result=L.select(data,stores,['b'],{today:'2026-10-19',engine:E});assert.equal(result.length,1);assert.deepEqual(result[0].stores.map(s=>s.id),['b']);assert.equal(result[0].end,'2026-10-24');
 assert.equal(L.select(data,stores,[],{today:'2026-10-19',engine:E}).length,0);
});
