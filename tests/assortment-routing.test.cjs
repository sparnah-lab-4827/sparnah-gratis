'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const E=require('../site/engine.js');
const stores=[{id:'a',name:'ALDI'},{id:'b',name:'Kaufland'},{id:'c',name:'REWE'}];
const p=(id,extra={})=>({id,title:id,groupId:id,variantId:id,pack:{min:500,max:500,unit:'g'},...extra});
const first=p('first'),second=p('second'),open=p('open');
const item=product=>({id:product.id,product,qty:1});
const price=(product,storeId,cents=100,extra={})=>({id:product.id+'-'+storeId,productId:product.id,title:product.title,
  storeId,priceCents:cents,groupIds:[product.groupId],variantIds:[product.variantId],pack:product.pack,
  verification:'source',start:'2026-10-19',end:'2026-10-24',...extra});
const options={enabledStores:['a','b','c'],weekStart:'2026-10-19',notBefore:'2026-10-20',maxStores:2};
const productHint=(product,storeId,extra={})=>({...product,assortmentStoreId:storeId,
  assortmentSourceUrl:'https://example.com/products/'+product.id,assortmentCheckedAt:'2026-10-20',...extra});
const hints=(product,storeIds,extra={})=>storeIds.map(storeId=>({storeId,products:[productHint(product,storeId,extra)]}));
const twoShopPrices=[price(first,'a'),price(second,'b')];
const plan=(hintRows,settings={},products=[first,second,open],prices=twoShopPrices)=>E.optimize(products.map(item),prices,stores,{
  ...options,...settings,assortmentHints:new Map([[open.id,hintRows]])});

test('a fresh matching assortment hint assigns an unpriced item to an already planned visit without adding a price',()=>{
  const before=E.optimize([first,second,open].map(item),twoShopPrices,stores,options);
  const result=plan(hints(open,['b']));
  const entry=result.unknown[0];
  assert.equal(entry.assignedStoreId,'b');assert.equal(entry.assignmentKind,'assortment');
  assert.equal(entry.assortmentEvidence.checkedAt,'2026-10-20');
  assert.equal(entry.assortmentEvidence.productId,open.id);
  assert.match(entry.assignmentReason,/Preis und Bestand.*offen/);
  assert.equal(result.visits.find(v=>v.store.id==='b').unpriced[0],entry);
  for(const key of ['total','coverage','complete','referenceSavings','comparisonTotal'])
    assert.equal(result[key],before[key],key);
  assert.equal(result.lines.filter(Boolean).length,2);assert.equal(result.visits.length,2);
});

test('a hint to an unplanned selected store does not create another visit or fall back to the wrong sole shop',()=>{
  const result=plan(hints(open,['b']),{},[first,open],[price(first,'a')]);
  assert.equal(result.visits.length,1);assert.equal(result.visits[0].store.id,'a');
  assert.equal(result.unknown[0].assignedStoreId,undefined);
  assert.deepEqual(result.unknown[0].assortmentStoreIds,['b']);
  assert.equal(result.visits[0].unpriced.length,0);
  assert.match(result.unknown[0].reason,/nicht eingeplanten Laden/);
  assert.equal(plan(hints(open,['b']),{},[open],[]).visits.length,0,'hints do not invent a route');
});

test('explicit destination remains a user errand and unknown-only single-shop trips retain their honest fallback',()=>{
  const explicit=plan(hints(open,['a']),{targetStoreId:'b'},[open],[]);
  assert.equal(explicit.unknown[0].assignedStoreId,'b');
  assert.equal(explicit.unknown[0].assignmentKind,'explicit-target');
  assert.match(explicit.unknown[0].assignmentReason,/ausdrücklich gewählter/);
  assert.equal(explicit.coverage,0);assert.equal(explicit.total,0);assert.equal(explicit.complete,false);
  assert.equal(explicit.unknown[0].assortmentEvidence,undefined);
  const fallback=plan([],{enabledStores:['a']},[open],[]);
  assert.equal(fallback.unknown[0].assignedStoreId,'a');
  assert.equal(fallback.unknown[0].assignmentKind,'single-visit');
  assert.match(fallback.unknown[0].assignmentReason,/nicht bestätigt/);
});

test('excluded stores never leak into hints or subscriptions and cannot redirect a planned trip',()=>{
  const result=plan(hints(open,['c']),{enabledStores:['a','b']},[first,open],[price(first,'a')]);
  assert.equal(result.unknown[0].assignedStoreId,'a');
  assert.equal(result.unknown[0].assignmentKind,'single-visit');
  assert.deepEqual(result.unknown[0].assortmentStoreIds,[]);
  assert.equal(result.visits.length,1);
});

test('variant, pack, source, date and merchant inconsistencies cannot become assortment evidence',()=>{
  const bad=[
    {variantId:'other'},{variantId:null},{groupId:'other',id:'other'},
    {pack:{min:400,max:400,unit:'g'}},{pack:{min:400,max:600,unit:'g'}},{pack:null},{packUnconfirmed:true},
    {assortmentStoreId:'a'},{assortmentSourceUrl:''},{assortmentSourceUrl:'http://example.com'},
    {assortmentSourceUrl:'https://user:secret@example.com'},
    {assortmentCheckedAt:'2026-09-19'},{assortmentCheckedAt:'2026-10-21'},
    {assortmentCheckedAt:'2026-09-31'},{assortmentCheckedAt:'not-a-date'}
  ];
  for(const extra of bad) {
    const result=plan(hints(open,['b'],extra));
    assert.equal(result.unknown[0].assignedStoreId,undefined,JSON.stringify(extra));
    assert.deepEqual(result.unknown[0].assortmentStoreIds,[],JSON.stringify(extra));
  }
  assert.equal(plan(hints(open,['b'],{assortmentCheckedAt:'2026-09-20T10:00:00Z'})).unknown[0].assignedStoreId,'b','30-day boundary is inclusive');
});

test('a generic wish requires explicit matching groups and never gains a concrete variant it did not permit',()=>{
  const generic=p('open',{groupId:'choice:generic',variantId:null});
  const catalogue=p('catalogue',{offerGroupIds:['choice:generic']});
  const rows=[{storeId:'b',products:[productHint(catalogue,'b')]}];
  assert.equal(plan(rows,{},[first,second,generic]).unknown[0].assignedStoreId,'b');
  assert.equal(plan(rows,{},[first,second,{...generic,variantId:'wanted-variant'}]).unknown[0].assignedStoreId,undefined);
  const wrong=[{storeId:'b',products:[productHint({...catalogue,offerGroupIds:['different']},'b')]}];
  assert.equal(plan(wrong,{},[first,second,generic]).unknown[0].assignedStoreId,undefined);
});

test('multiple matching visits choose the earliest planned day then stable shop id without changing the route',()=>{
  const result=plan(hints(open,['b','a']));
  assert.equal(result.unknown[0].assignedStoreId,'a');
  const reordered=E.optimize([first,second,open].map(item),twoShopPrices.toReversed(),stores.toReversed(),
    {...options,assortmentHints:{open:hints(open,['a','b'])}});
  assert.equal(reordered.unknown[0].assignedStoreId,'a');
  const dated=plan(hints(open,['a','b']),{allowSplitDays:true},[first,second,open],
    [price(first,'a',100,{start:'2026-10-22',end:'2026-10-22'}),price(second,'b',100,{end:'2026-10-20'})]);
  assert.equal(dated.unknown[0].assignedStoreId,'b');assert.equal(dated.unknown[0].assignedDay,'2026-10-20');
});

test('a closed hinted shop cannot attract a visit or leave an empty fallback visit behind',()=>{
  const closed=stores.map(store=>({...store,...(store.id==='b'?{temporaryClosureUntil:'2026-10-31'}:{})}));
  const result=E.optimize([open].map(item),[],closed,{...options,enabledStores:['a','b'],assortmentHints:{open:hints(open,['b'])}});
  assert.equal(result.visits.length,0);assert.equal(result.unknown[0].assignedStoreId,undefined);
  assert.equal(result.coverage,0);assert.equal(result.complete,false);
});

test('Map hints work across application/test realms and neither catalogues nor hints are mutated',()=>{
  const rows=hints(open,['b']),saved=JSON.stringify(rows),map=vm.runInNewContext('new Map()');
  map.set(open.id,rows);
  const result=E.optimize([first,second,open].map(item),twoShopPrices,stores,{...options,assortmentHints:map});
  assert.equal(result.unknown[0].assignedStoreId,'b');assert.equal(JSON.stringify(rows),saved);
});

test('an optional trusted catalogue resolver permits strict manufacturer aliases and rejects untrusted objects or uncertain matches',()=>{
  const catalogue=productHint(p('retailer-alias'),'b'),trusted=new WeakSet([catalogue]);
  const rows=[{storeId:'b',products:[catalogue]}];
  const assortmentMatcher=(wish,candidate)=>trusted.has(candidate)&&wish.id===open.id?{status:'exact'}:{status:'none'};
  assert.equal(plan(rows).unknown[0].assignedStoreId,undefined,'default matching does not invent aliases');
  assert.equal(plan(rows,{assortmentMatcher}).unknown[0].assignedStoreId,'b');
  assert.equal(plan([{storeId:'b',products:[{...catalogue}]}],{assortmentMatcher}).unknown[0].assignedStoreId,undefined);
  for (const result of [null,undefined,{status:'none'},{status:'uncertain'},'exact',{status:'other'}]) {
    assert.equal(plan(rows,{assortmentMatcher:()=>result}).unknown[0].assignedStoreId,undefined);
  }
  assert.equal(plan(rows,{assortmentMatcher:()=>{throw new Error('stale resolver');}}).unknown[0].assignedStoreId,undefined);
});

test('a catalogue resolver cannot bypass actual pack, merchant, date or source checks',()=>{
  for (const extra of [
    {pack:{min:400,max:400,unit:'g'}},{pack:{min:500,max:500,unit:'ml'}},{pack:{min:500,max:500,unit:''}},
    {packUnconfirmed:true},{assortmentSourceUrl:'http://example.com'},
    {assortmentCheckedAt:'2026-09-01'},{assortmentStoreId:'a'}
  ]) {
    assert.equal(plan(hints(open,['b'],extra),{assortmentMatcher:()=>({status:'exact'})}).unknown[0].assignedStoreId,undefined);
  }
});

test('unpriced cheapest-mode errands require assortment evidence for the saved original rather than an unpriced own-label substitute',()=>{
  const original=p('nutella',{pack:{min:450,max:450,unit:'g'}});
  const alternative=p('spread-wish',{groupId:'generic-spread',variantId:null,pack:{min:400,max:500,unit:'g'}});
  const substitute=productHint(p('own-label',{offerGroupIds:['generic-spread'],pack:{min:400,max:400,unit:'g'}}),'b');
  const unpriced={id:'open',product:alternative,requestedProduct:original,qty:1};
  const make=(product,extra={})=>E.optimize([item(first),item(second),unpriced],twoShopPrices,stores,{
    ...options,...extra,assortmentHints:{open:[{storeId:'b',products:[product]}]}
  });
  const missing=make(substitute);
  assert.equal(missing.unknown[0].assignedStoreId,undefined);
  assert.equal(missing.unknown[0].assignmentKind,undefined);
  assert.deepEqual(missing.unknown[0].assortmentStoreIds,[]);
  assert.equal(make({...substitute,pack:original.pack}).unknown[0].assignmentKind,undefined,'equal size alone does not establish the original brand');
  const exact=productHint(original,'b');
  assert.equal(make(exact).unknown[0].assignmentKind,'assortment');
  let checkedWish;
  assert.equal(make(exact,{assortmentMatcher:(wish,p)=>{checkedWish=wish;return wish===original&&p===exact?{status:'exact'}:{status:'none'};}}).unknown[0].assignmentKind,'assortment');
  assert.equal(checkedWish,original,'trusted resolvers also receive the saved original');
  assert.equal(make(substitute,{assortmentMatcher:()=>({status:'group'})}).unknown[0].assignmentKind,undefined,'the original pack is checked independently of the resolver');
});

test('cached formatters preserve German currency, quantity ranges and Berlin date rollover',()=>{
  assert.equal(E.money(123456),new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(1234.56));
  assert.equal(E.packLabel({min:1200,max:4400,unit:'Blatt'}),'1.200–4.400 Blatt');
  assert.equal(E.shortDate('2026-10-20'),new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date('2026-10-20T12:00:00Z')));
  assert.equal(E.shortDate('2026-10-20',true),new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',weekday:'short',timeZone:'UTC'}).format(new Date('2026-10-20T12:00:00Z')));
  assert.equal(E.berlinToday(new Date('2026-10-19T22:30:00Z')),'2026-10-20');
});
