'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../site/engine.js'),I=require('../site/install.js');
const shops=[{id:'a',name:'A'},{id:'b',name:'B'}];
const product={id:'aperitif',title:'Aperitif 11 % 700 ml',groupId:'aperitif',variantId:'classic',pack:{min:700,max:700,unit:'ml'},assortmentStoreId:'a'};
const items=[{id:'one',product,qty:1}],options={enabledStores:['a','b'],weekStart:'2026-10-19',notBefore:'2026-10-19',maxStores:1};
test('explicit destination takes an unpriced list without inventing prices or exclusivity',()=>{
 const p=E.optimize(items,[],shops,{...options,targetStoreId:'b'});
 assert.equal(p.visits.length,1);assert.equal(p.visits[0].store.id,'b');assert.equal(p.unknown[0].assignedStoreId,'b');assert.equal(p.coverage,0);assert.equal(p.complete,false);assert.equal(p.visits[0].lines.length,0);
});
test('source is not an implicit destination and excluded or closed stores stay excluded',()=>{
 assert.equal(E.optimize(items,[],shops,options).visits.length,0);
 assert.equal(E.optimize(items,[],shops,{...options,enabledStores:[],targetStoreId:'b'}).visits.length,0);
 const closed=shops.map(s=>({...s,temporaryClosureUntil:'2026-10-31'}));
 assert.equal(E.optimize(items,[],closed,{...options,targetStoreId:'b'}).visits.length,0);
});
test('explicit shop excludes cheaper offers elsewhere and never substitutes a different pack',()=>{
 const offers=[{id:'cheap',storeId:'a',productId:'aperitif',variantIds:['classic'],groupIds:['aperitif'],pack:product.pack,priceCents:999,verification:'source',start:'2026-10-19',end:'2026-10-24'},
 {id:'spritz',storeId:'b',productId:'spritz',variantIds:['spritz'],groupIds:['spritz'],pack:{min:600,max:600,unit:'ml'},priceCents:699,verification:'source',start:'2026-10-19',end:'2026-10-24'}];
 const p=E.optimize(items,offers,shops,{...options,targetStoreId:'b'});
 assert.equal(p.coverage,0);assert.equal(p.unknown[0].assignedStoreId,'b');
});
function browser(standalone=false){const handlers={};return {handlers,addEventListener:(n,f)=>handlers[n]=f,matchMedia:()=>({matches:standalone}),navigator:{}};}
test('installer captures early event once and accepted is not an installed claim',async()=>{
 const w=browser(),i=I.create(w);let prompts=0,prevented=false;
 w.handlers.beforeinstallprompt({preventDefault(){prevented=true},prompt(){prompts++},userChoice:Promise.resolve({outcome:'accepted'})});
 assert.equal((await i.request()).outcome,'accepted');assert.equal(prevented,true);assert.equal(i.isInstalled(),false);
 assert.equal((await i.request()).outcome,'instructions');assert.equal(prompts,1);
 w.handlers.appinstalled();assert.equal((await i.request()).outcome,'installed');
});
test('installer handles standalone, dismissal and concurrent clicks',async()=>{
 assert.equal((await I.create(browser(true)).request()).outcome,'installed');
 const w=browser(),i=I.create(w);let finish;
 w.handlers.beforeinstallprompt({preventDefault(){},prompt(){return new Promise(r=>finish=r)},userChoice:Promise.resolve({outcome:'dismissed'})});
 const first=i.request();assert.equal((await i.request()).outcome,'busy');finish();assert.equal((await first).outcome,'dismissed');assert.equal((await i.request()).outcome,'instructions');
});
