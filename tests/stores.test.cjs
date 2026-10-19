const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../site/stores.js'),E=require('../site/engine.js');
const catalog={stores:[
 {id:'a1',name:'ALDI SÜD – Example North',retailerId:'aldi',city:'Example'},
 {id:'a2',name:'ALDI SÜD – Example South',retailerId:'aldi',city:'Example',preferredDisplay:true},
 {id:'r1',name:'REWE First',retailerId:'rewe'},{id:'r2',name:'REWE Second',retailerId:'rewe'},
 {id:'e1',name:'E center First',retailerId:'edeka'},{id:'e2',name:'EDEKA Second',retailerId:'edeka'}],
 offers:[{id:'shared',storeId:'a1',applicableStoreIds:['a1','a2']},{id:'exclusive',storeId:'a1'},{id:'rewe',storeId:'r2'}]};
test('all chains appear once, Aldi uses preferred market and selected chains remain selected',()=>{
 const before=JSON.stringify(catalog),view=S.project(catalog,{enabledStores:['a1','r2','e1','e2'],targetStoreId:'a1'},E);
 assert.deepEqual(view.catalog.stores.map(s=>s.name),['ALDI','REWE','EDEKA']);
 assert.deepEqual(view.catalog.stores.map(s=>s.id),['a2','r2','e1']);
 assert.deepEqual(view.settings.enabledStores,['a2','r2','e1']);assert.equal(view.settings.targetStoreId,'a2');
 assert.equal(view.aliases.a1,'a2');assert.equal(JSON.stringify(catalog),before);
 assert.deepEqual(S.project(catalog,view.settings,E).settings,view.settings);
});
test('only explicitly shared offers transfer; hidden exclusive offers never acquire broader validity',()=>{
 const view=S.project(catalog,{enabledStores:['a1','r1']},E);
 assert.deepEqual(view.catalog.offers.map(o=>o.id),['shared:a2']);
 assert.equal(view.catalog.offers[0].storeId,'a2');
 assert.deepEqual(S.project(catalog,{enabledStores:[]},E).settings.enabledStores,[]);
});
