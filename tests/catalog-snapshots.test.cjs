'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../site/search.js'),P=require('../site/selection.js'),E=require('../site/engine.js');
const pack=n=>({min:n,max:n,unit:'g'});
const product=(id,title,extra={})=>({id,title,brand:'Acme',groupId:'food',variantId:id,pack:pack(250),...extra});
const photo={image:'https://example.org/photo.png',imageSourceUrl:'https://example.org/product',imagePack:pack(250)};
const products=[
 product('plain','Acme Butter'),
 product('photo','Acme Butter',{...photo}),
 product('alt','Acme Butter',{...photo,imageAlt:'Andere Sorte'}),
 product('large','Acme Butter',{...photo,pack:pack(500)}),
 product('no-brand','Butter',{brand:''}),
 product('many','Acme Butter oder Margarine',{...photo}),
 product('unicode','MÜLLER Kräuterbutter'),
 product('brand2','Dallmayr Classic',{brand:'Dallmayr'}),
 product('brand3','Ben & Jerry’s Eis',{brand:'Ben & Jerry’s'})
];
const offer=(id,title,extra={})=>({id,productId:'photo',title,storeId:'a',pack:pack(250),priceCents:199,
 variantIds:['photo'],groupIds:['food'],verification:'source',start:'2026-10-19',end:'2026-10-24',...extra});
const offers=[
 offer('a','Acme Butter'),offer('b','Butter'),offer('c','Acme Butter oder Margarine'),
 offer('d','Acme Butter',{pack:pack(500)}),offer('e','Butter',{packUnconfirmed:true}),
 offer('f','MÜLLER Kräuterbutter',{productId:'unicode',variantIds:['unicode']}),
 offer('g','Dallmayr Classic',{productId:'brand2',storeId:'b'}),
 offer('h','Ben & Jerry’s Eis',{productId:'brand3',requiresCard:true}),
 offer('i','TOP-ANGEBOT NEUMARKE Kaffee',{productId:'unknown'}),
 offer('j','Acme Butter',{minQty:2,start:'2026-10-26',end:'2026-10-31'})
];

test('indexed selector is differential-equivalent across title, photo, variant, ambiguity and pack boundaries',()=>{
 const selector=P.createSelector(products),mapSelector=P.createSelector(new Map(products.map(p=>[p.id,p])));
 const items=[...products,product('wish','Butter',{brand:'',variantId:null,groupId:'butter'}),null];
 for(const item of items)for(const o of [...offers,null]){
  assert.deepEqual(selector.chosenProduct(item,o),P.chosenProduct(item,o,products));
  assert.deepEqual(mapSelector.chosenProduct(item,o),P.chosenProduct(item,o,products));
 }
 const butter=offer('butter','Landliebe Butter oder Die Streichzarte',{productId:'unknown',variantIds:null});
 assert.deepEqual(selector.chosenProduct(items.at(-2),butter),P.chosenProduct(items.at(-2),butter,products));
});

test('selector captures a catalogue snapshot; new catalogue and saved offer snapshots take effect explicitly',()=>{
 const data=[product('photo','Acme Butter',{...photo,imagePack:pack(250)})],before=structuredClone(data);
 const selector=P.createSelector(data),o=offer('one','Acme Butter');
 data[0].image='https://example.org/new.png';data[0].pack.min=999;data.push(product('added','Butter',{...photo}));
 assert.deepEqual(selector.chosenProduct(before[0],o),P.chosenProduct(before[0],o,before));
 assert.deepEqual(P.createSelector(data).chosenProduct(before[0],o),P.chosenProduct(before[0],o,data));
 const result=selector.chosenProduct(before[0],o);result.product.imagePack.min=1;
 assert.equal(selector.chosenProduct(before[0],o).imageConfirmed,true);
 assert.deepEqual(selector.chosenProduct({...before[0],pack:pack(800)},{...o,pack:pack(800)}),
  P.chosenProduct({...before[0],pack:pack(800)},{...o,pack:pack(800)},before));
});

test('snapshot brand search preserves original suggestions, counts, sorting and eligibility',()=>{
 const index=S.build(products),snapshot=S.createBrandSearch(index,offers);
 for(const query of ['', 'a','ac','acme','MÜ','dall','classic','ben & j','neu','unknown']){
  for(const options of [
   {engine:E,weekStart:'2026-10-19'},
   {engine:E,weekStart:'2026-10-19',storeIds:['a'],limit:2},
   {engine:E,weekStart:'2026-10-19',storeIds:[],storeId:'a',limit:0},
   {engine:E,weekStart:'2026-10-26',storeId:'b',limit:4}
  ]){
   assert.deepEqual(snapshot.brandOffers(query,options),S.brandOffers(index,offers,query,options));
   assert.deepEqual(snapshot.brandSuggestions(query,options),S.brandSuggestions(index,offers,query,options));
  }
 }
});

test('brand snapshots invalidate on rebuild and callers cannot mutate cached offer identity or packs',()=>{
 const data=structuredClone(offers),catalog=structuredClone(products),index=S.build(catalog),before=structuredClone(data);
 const snapshot=S.createBrandSearch(index,data),options={engine:E,weekStart:'2026-10-19'};
 data[0].title='Changed';data[0].requiresCard=true;data[0].pack.min=999;catalog[0].brand='Changed';
 assert.deepEqual(snapshot.brandOffers('acme',options),S.brandOffers(index,before,'acme',options));
 assert.deepEqual(S.createBrandSearch(S.build(catalog),data).brandOffers('acme',options),S.brandOffers(S.build(catalog),data,'acme',options));
 const results=snapshot.brandOffers('acme',options);results[0].title='Mutated';results[0].pack.min=1;results[0].variantIds.push('bad');
 assert.deepEqual(snapshot.brandOffers('acme',options),S.brandOffers(index,before,'acme',options));
});

test('brand filter cache is bounded and does not accumulate per-query history',()=>{
 let calls=0;const engine={daysOfWeek:E.daysOfWeek,validOn(o,day){calls++;return E.validOn(o,day);},offerUsable:E.offerUsable};
 const snapshot=S.createBrandSearch(S.build(products),offers),options={engine,weekStart:'2026-10-19'};
 snapshot.brandSuggestions('a',options);const first=calls;
 for(let i=0;i<100;i++)snapshot.brandSuggestions('query'+i,options);
 snapshot.brandOffers('acme',options);assert.equal(calls,first);
 for(let i=1;i<=8;i++)snapshot.brandSuggestions('',{engine,weekStart:E.addDays('2026-10-19',i*7)});
 const evicted=calls;snapshot.brandSuggestions('',options);assert.ok(calls>evicted);
});

test('brand offers and counts exclude expired days while retaining today and upcoming deals',()=>{
 const data=[
  offer('expired','Acme Butter',{end:'2026-10-22'}),
  offer('today','Acme Butter',{start:'2026-10-23',end:'2026-10-23'}),
  offer('tomorrow','Acme Butter',{start:'2026-10-24',end:'2026-10-24'}),
  offer('old-start-only','Acme Butter',{start:'2026-10-22',end:null}),
  offer('today-start-only','Acme Butter',{start:'2026-10-23',end:null}),
  offer('next-week','Acme Butter',{start:'2026-10-26',end:'2026-10-31'}),
  offer('other-store','Acme Butter',{storeId:'b'}),
  offer('card-only','Acme Butter',{requiresCard:true})
 ];
 const index=S.build(products),snapshot=S.createBrandSearch(index,data);
 const options={engine:E,weekStart:'2026-10-19',notBefore:'2026-10-23',storeIds:['a']};
 const expected=['today','today-start-only','tomorrow'];
 assert.deepEqual(S.brandOffers(index,data,'acme',options).map(o=>o.id).sort(),expected);
 assert.deepEqual(snapshot.brandOffers('acme',options).map(o=>o.id).sort(),expected);
 for(const suggestions of [S.brandSuggestions(index,data,'acme',options),snapshot.brandSuggestions('acme',options)]){
  assert.equal(suggestions.find(row=>row.key==='acme').count,3);
 }
});

test('brand snapshots advance the date inside one week without reusing yesterday counts',()=>{
 const data=[
  offer('thursday','Acme Butter',{start:'2026-10-22',end:'2026-10-22'}),
  offer('friday','Acme Butter',{start:'2026-10-23',end:'2026-10-23'}),
  offer('saturday','Acme Butter',{start:'2026-10-24',end:'2026-10-24'})
 ];
 const index=S.build(products),snapshot=S.createBrandSearch(index,data),options={engine:E,weekStart:'2026-10-19'};
 for(const [notBefore,count]of [[undefined,3],['2026-10-22',3],['2026-10-23',2],['2026-10-24',1],['2026-10-25',0],['2026-10-23',2]]){
  const activeOptions={...options,...(notBefore?{notBefore}:{})};
  assert.equal(snapshot.brandSuggestions('acme',activeOptions).find(row=>row.key==='acme').count,count);
  assert.equal(snapshot.brandOffers('acme',activeOptions).length,count);
  assert.deepEqual(snapshot.brandOffers('acme',activeOptions),S.brandOffers(index,data,'acme',activeOptions));
  assert.deepEqual(snapshot.brandSuggestions('acme',activeOptions),S.brandSuggestions(index,data,'acme',activeOptions));
 }
});
