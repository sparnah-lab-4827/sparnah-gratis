'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../site/search.js'),C=require('../site/choices.js'),E=require('../site/engine.js');
const pack=n=>({min:n,max:n,unit:'g'});
const names=[
 ['bami','Bami Goreng','Bami Goreng',500],
 ['butter','Butter Chicken','Butter Chicken',500],
 ['fricassee','Hühnerfrikassee','Hühner Frikassee',500],
 ['potato','Bratkartoffelpfanne mit Hähnchen','Bratkartoffel Hähnchen Pfanne',500],
 ['salmon','Pasta Wildlachs','Pasta Wildlachs',450]
];
function fixtures(){
 const assortment=names.map(([id,title,,n])=>({id:'assortment:aldi:'+id,title:`FROSTA Fertiggerichte, ${title} ${n} g`,
  brand:'FROSTA',groupId:'assortment:aldi:'+id,variantId:'assortment:aldi:'+id,pack:pack(n),
  assortmentStoreId:'b',assortmentSourceUrl:'https://example.org/products/'+id,assortmentCheckedAt:'2026-10-20',
  availabilityConfirmed:false}));
 const manufacturers=names.map(([id,,title,n])=>({id:'manufacturer:'+id,title:'FRoSTA '+title,brand:'FRoSTA',
  groupId:'frosta-meals',variantId:'manufacturer:'+id,pack:pack(n),line:'Standard'}));
 const products=[...assortment,...manufacturers];
 return {assortment,manufacturers,products};
}
const prepare=f=>S.createAssortmentHints(f.assortment,{choices:C,products:f.products,engine:E});

test('prepared assortment reuses exact audited FRoSTA aliases, preserving all original evidence',()=>{
 const f=fixtures(),before=JSON.stringify(f),snapshot=prepare(f);
 f.manufacturers.forEach((wish,i)=>{
  const hints=snapshot.assortmentHints(wish,{storeIds:['a','b']});
  assert.equal(hints.length,1);assert.equal(hints[0].storeId,'b');
  assert.equal(hints[0].products.length,1);assert.equal(hints[0].products[0],f.assortment[i]);
  assert.equal(snapshot.match(wish,f.assortment[i]).status,'exact');
  f.assortment.forEach((p,j)=>{if(i!==j)assert.equal(snapshot.match(wish,p).status,'none');});
  assert.deepEqual(snapshot.assortmentHints(wish,{storeIds:[]}),[]);
  assert.deepEqual(snapshot.assortmentHints(wish,{storeIds:['a']}),[]);
  assert.equal(snapshot.match(wish,{...f.assortment[i]}).status,'none','caller copies cannot acquire trusted aliases');
  assert.equal(hints[0].products[0].availabilityConfirmed,false);
  assert.equal(hints[0].products[0].verification,undefined);
  assert.equal(hints[0].products[0].priceCents,undefined);
 });
 assert.equal(JSON.stringify(f),before);
 const large={...f.manufacturers[1],pack:pack(800)};
 assert.deepEqual(snapshot.assortmentHints(large),[]);
 const saved={...f.manufacturers[0],id:'old-bami',variantId:'old-bami'};
 assert.deepEqual(snapshot.assortmentHints(saved),[]);
 const withSaved=prepare({...f,products:[...f.products,saved]});
 assert.equal(withSaved.assortmentHints(saved)[0].products[0],f.assortment[0],'all catalogue and saved wish identities belong in the snapshot');
});

test('source updates invalidate original object evidence until the prepared snapshot is rebuilt',()=>{
 for(const mutate of [
  p=>{p.pack.min=p.pack.max=800;},p=>{p.title='FROSTA Bami Goreng 500 g';},
  p=>{p.assortmentSourceUrl='https://example.org/changed';},p=>{p.assortmentCheckedAt='2026-10-21';},
  p=>{p.assortmentStoreId='a';},p=>{p.packUnconfirmed=true;},p=>{p.variantId='changed';}
 ]){
  const f=fixtures(),snapshot=prepare(f),p=f.assortment[1],wish=f.manufacturers[1];
  mutate(p);assert.equal(snapshot.match(wish,p).status,'none');assert.deepEqual(snapshot.assortmentHints(wish),[]);
 }
 const f=fixtures(),snapshot=prepare(f);f.assortment[1].assortmentCheckedAt='2026-10-21';
 const rebuilt=prepare(f);
 assert.equal(snapshot.match(f.manufacturers[1],f.assortment[1]).status,'none');
 assert.equal(rebuilt.match(f.manufacturers[1],f.assortment[1]).status,'exact');
});

test('index preserves legacy hints and catalogue order when no aliases are involved',()=>{
 const assortment=['a','b','a'].map((store,i)=>({id:'p'+i,title:'Test '+i,groupId:'test',variantId:'p'+i,pack:pack(500),
  assortmentStoreId:store,assortmentSourceUrl:'https://example.org/'+i,assortmentCheckedAt:'2026-10-20'}));
 const snapshot=S.createAssortmentHints(assortment,{choices:C,products:assortment,engine:E});
 for(const wish of [...assortment,{id:'generic',groupId:'test',pack:pack(500)}])
  for(const storeIds of [undefined,[],['a'],['a','b']])
   assert.deepEqual(snapshot.assortmentHints(wish,{storeIds}),S.assortmentHints(wish,assortment,{engine:E,storeIds}));
});

test('factory callback routes an unpriced exact product while engine still rejects stale, future, HTTP and unknown packs',()=>{
 const stores=[{id:'a',name:'Store A'},{id:'b',name:'Store B'}];
 const priced=['a','b'].map(id=>({id,title:id,groupId:id,variantId:id,pack:pack(500)}));
 const offers=priced.map(p=>({id:p.id,productId:p.id,title:p.title,storeId:p.id,priceCents:100,
  groupIds:[p.groupId],variantIds:[p.variantId],pack:p.pack,verification:'source',start:'2026-10-19',end:'2026-10-24'}));
 function run(extra={},wishExtra={}){
  const f=fixtures();Object.assign(f.assortment[1],extra);Object.assign(f.manufacturers[1],wishExtra);
  const snapshot=prepare(f),wish=f.manufacturers[1],items=[...priced,wish].map(product=>({id:product.id,product,qty:1}));
  return E.optimize(items,offers,stores,{enabledStores:['a','b'],weekStart:'2026-10-19',notBefore:'2026-10-20',maxStores:2,
   assortmentHints:new Map([[wish.id,snapshot.assortmentHints(wish)]]),assortmentMatcher:snapshot.match});
 }
 const good=run(),entry=good.unknown[0];
 assert.equal(entry.assignedStoreId,'b');assert.equal(entry.assignmentKind,'assortment');
 assert.equal(entry.assortmentEvidence.productId,'assortment:aldi:butter');
 assert.equal(good.total,200);assert.equal(good.coverage,2);assert.equal(good.complete,false);
 for(const extra of [
  {assortmentCheckedAt:'2026-09-19'},{assortmentCheckedAt:'2026-10-21'},
  {assortmentSourceUrl:'http://example.org/item'},{packUnconfirmed:true},
  {pack:{min:450,max:500,unit:'g'}},{title:'FROSTA Butter Chicken oder Bami Goreng 500 g'}
 ]) assert.equal(run(extra).unknown[0].assignedStoreId,undefined,JSON.stringify(extra));
 assert.equal(run({}, {pack:pack(800)}).unknown[0].assignedStoreId,undefined);
});
