'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../site/choices.js'),E=require('../site/engine.js'),S=require('../site/search.js');
const pack=(n=1000,unit='ml')=>({min:n,max:n,unit});
const product=(id,title,extra={})=>({id,title,brand:'Brand A',variantId:id,groupId:id,pack:pack(),...extra});
const offer=(p,priceCents=199,extra={})=>({id:p.id,productId:p.id,title:p.title,brand:p.brand,pack:p.pack,groupIds:[p.groupId],variantIds:[p.variantId],priceCents,storeId:'a',verification:'source',start:'2026-10-19',end:'2026-10-24',...extra});
const settings={enabledStores:['a','b'],weekStart:'2026-10-19',notBefore:'2026-10-19',maxStores:1};
const wish=id=>C.basicWishes().find(p=>p.id==='basic:'+id);
function plan(wanted,products,offers){
  return E.optimize([{id:wanted.id,product:wanted,qty:1}],C.annotateOffers(offers,[wanted,...products]),[{id:'a'},{id:'b'}],settings);
}

test('forty price-free wishes have stable identities, explicit sizes, and actual matching profiles',()=>{
  const wishes=C.basicWishes();
  assert.equal(wishes.length,40);assert.equal(new Set(wishes.map(p=>p.id)).size,40);
  for(const p of wishes){
    assert.match(p.id,/^basic:/);assert.match(p.groupId,/^choice:/);assert.equal(p.brand,'');
    assert.equal(p.variantId,null);assert.equal(p.isGroupChoice,true);
    assert.equal(p.pack.min,p.pack.max);assert.match(p.subtitle,/Marke egal/);
    assert.equal(Object.hasOwn(p,'priceCents'),false);assert.equal(Object.hasOwn(p,'assortmentStoreId'),false);
    assert.notEqual(C.getChoice(p).kind,'exact',p.title);
    const concrete={...p,id:'concrete:'+p.id,title:'Brand A '+p.title,brand:'Brand A',variantId:'v',isGroupChoice:false,juiceStyleAny:false};
    assert.equal(plan(p,[concrete],[offer(concrete)]).coverage,1,p.title);
  }
  const shuffled=[product('z','Brand B Apfelsaft',{brand:'Brand B'}),product('a','Brand A Spaghetti',{pack:pack(500,'g')})];
  assert.deepEqual(C.basicWishes(shuffled),wishes);
  assert.deepEqual(C.basicWishes(shuffled.reverse()),wishes);
  const before=JSON.stringify(wishes);C.basicWishes()[0].pack.min=1;assert.equal(JSON.stringify(C.basicWishes()),before);
});

test('existing equivalent general wishes suppress duplicates only for the same meaning and pack',()=>{
  const general={...wish('oats-fine'),id:'existing-oats',title:'Zarte Haferflocken'};
  assert.ok(!C.basicWishes([general]).some(p=>p.id==='basic:oats-fine'));
  assert.ok(C.basicWishes([general]).some(p=>p.id==='basic:oats-coarse'));
  assert.ok(C.basicWishes([{...general,pack:pack(1000,'g')}]).some(p=>p.id==='basic:oats-fine'));
  assert.ok(C.basicWishes([{...general,brand:'Brand A'}]).some(p=>p.id==='basic:oats-fine'));
  assert.ok(C.basicWishes([{...general,groupId:'unconnected-legacy-group'}]).some(p=>p.id==='basic:oats-fine'));
  const butter={id:'butter',title:'Butter',brand:'',variantId:null,groupId:'butter',pack:pack(250,'g')};
  assert.ok(!C.basicWishes([butter]).some(p=>p.id==='basic:butter'));
  assert.equal(C.basicWishes(C.basicWishes()).length,0);
});

test('apple juice wish chooses real offers across brands and juice styles without a second opt-in',()=>{
  const wanted=wish('juice-apple');
  const products=[
    product('clear','Brand A Apfelsaft klar aus Apfelsaftkonzentrat 1 l'),
    product('cloudy','Brand B Naturtrüber Apfelsaft Direktsaft 1 l',{brand:'Brand B'}),
    product('plain',"RIO D' ORO Apfelsaft 1 l",{brand:"RIO D' ORO"}),
    product('pure','Brand C 100 % Apfelsaft',{brand:'Brand C'})
  ];
  for(const p of products)assert.equal(plan(wanted,products,[offer(p)]).coverage,1,p.title);
  const offers=products.map((p,i)=>offer(p,[179,149,129,199][i],{storeId:i%2?'b':'a'}));
  const before=JSON.stringify(offers),result=plan(wanted,products,offers);
  assert.equal(result.lines[0].offer.productId,'plain');assert.equal(result.total,129);
  assert.equal(JSON.stringify(offers),before);
  assert.match(wanted.subtitle,/Art egal/);
  assert.equal(plan(wanted,products,[]).coverage,0);
});

test('juice wishes reject nectar, spritzers, mixed fruit, diet variants, ambiguous names and other packs',()=>{
  const wanted=wish('juice-apple');
  const titles=[
    'Apfelnektar','Apfelschorle','Apfelsaft oder Nektar','Apfelsaft Light','Apfelsaft verdünnt',
    'Apfelsaft Mango','Apfelsaft Fruchtmix','Apfelsaft mit Wasser','Apfelsaft aus Orangensaftkonzentrat',
    'Apfelsaft klar naturtrüb','Apfelsaft Direktsaft aus Konzentrat','Apfelsaft-Konzentrat',
    'Orangensaft','Traubensaft','Bio Apfelsaft','Apfelsaft zuckerfrei','Apfelsaft mit Vitamin C'
  ];
  for(const title of titles){
    const p=product('bad',title);assert.equal(plan(wanted,[p],[offer(p,1)]).coverage,0,title);
  }
  for(const extra of [{pack:pack(750)},{pack:pack(1500)},{pack:pack(1000,'g')},{bio:true},{lactoseFree:true}]){
    const p=product('bad','Apfelsaft',extra);assert.equal(plan(wanted,[p],[offer(p,1)]).coverage,0,JSON.stringify(extra));
  }
  const p=product('plain','Apfelsaft');
  for(const extra of [{requiresCard:true},{requiresApp:true},{verification:'unverified'},{packUnconfirmed:true},{end:'2026-10-18'}]){
    assert.equal(plan(wanted,[p],[offer(p,1,extra)]).coverage,0,JSON.stringify(extra));
  }
  const larger=product('larger','Apfelsaft',{pack:pack(1200)});
  assert.equal(plan(wanted,[larger],[offer(larger)]).coverage,0);
  assert.equal(plan(C.getChoice(wanted).product,[larger],[offer(larger)]).coverage,1);
});

test('specific juice choices retain clarity, processing and dietary properties independently',()=>{
  const exact=product('wish','Brand A Apfelsaft naturtrüb Direktsaft');
  const chosen=C.getChoice(exact,[exact]).product;
  for(const title of ['Apfelsaft klar Direktsaft','Apfelsaft naturtrüb aus Konzentrat','Apfelsaft naturtrüb','Bio Apfelsaft naturtrüb Direktsaft']){
    const p=product('bad',title);assert.equal(plan(chosen,[p],[offer(p)]).coverage,0,title);
  }
  const same=product('same','Brand B Direktsaft Apfelsaft naturtrüb',{brand:'Brand B'});
  assert.equal(plan(chosen,[same],[offer(same)]).coverage,1);
  for(const [id,title] of [['juice-orange','Orangensaft Direktsaft'],['juice-grape','Traubensaft klar']]){
    const p=product(id,title);assert.equal(plan(wish(id),[p],[offer(p)]).coverage,1);
    assert.equal(plan(wish('juice-apple'),[p],[offer(p)]).coverage,0);
  }
});

test('generic wishes lead ordinary searches, remain available with a source filter, and never match a brand query',()=>{
  const branded=product('assortment:juice','Brand A Apfelsaft',{assortmentStoreId:'a'});
  const index=S.build([branded],C.basicWishes([branded]));
  assert.equal(S.search(index,'apfelsaft').items[0].id,'basic:juice-apple');
  assert.equal(S.search(index,'apfelsaft',{store:'a'}).items[0].id,'basic:juice-apple');
  assert.deepEqual(S.search(index,'Brand A Apfelsaft').items.map(p=>p.id),[branded.id]);
  assert.ok(!S.search(index,'schorle').items.some(p=>p.id==='basic:juice-apple'));
  const saved=JSON.parse(JSON.stringify(wish('juice-apple')));
  assert.deepEqual(S.restoreProduct({id:saved.id,product:saved},index),saved);
});
