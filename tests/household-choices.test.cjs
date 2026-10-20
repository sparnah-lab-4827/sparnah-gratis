'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../site/choices.js'),E=require('../site/engine.js'),S=require('../site/search.js');
const pack=(n,unit='ml')=>({min:n,max:n,unit});
const wish=id=>C.householdWishes().find(p=>p.id==='basic:household-'+id);
const product=(title,amount=500,unit='ml',extra={})=>({id:'item',title,brand:'Testmarke',variantId:'item',groupId:'item',pack:pack(amount,unit),...extra});
const offer=(p,extra={})=>({id:'offer',productId:p.id,title:p.title,brand:p.brand,pack:p.pack,priceCents:199,storeId:'shop',
  groupIds:[p.groupId],variantIds:[p.variantId],verification:'source',start:'2026-10-19',end:'2026-10-24',...extra});
test('paper unit prices remain readable per hundred sheets rather than rounded to zero per sheet',()=>{
  assert.equal(E.unitPrice({priceCents:295,pack:pack(1200,'Blatt')}),'0,25 € / 100 Blatt');
  assert.equal(E.unitPrice({priceCents:265,pack:pack(256,'Blatt')}),'1,04 € / 100 Blatt');
});
function match(wanted,p,extra={}){
  const annotated=C.annotateOffers([offer(p,extra)],[wanted,p,...C.referenceProducts()])[0];
  return E.match(wanted,annotated).status;
}

test('household wishes and manufacturer references are stable, price-free and searchable without stock claims',()=>{
  const wishes=C.householdWishes(),references=C.referenceProducts();
  assert.equal(wishes.length,12);assert.equal(references.length,5);assert.equal(C.basicWishes().length,40);
  assert.equal(new Set([...wishes,...references].map(p=>p.id)).size,17);
  for(const p of [...wishes,...references]){
    assert.equal(p.pack.min,p.pack.max);
    for(const forbidden of ['priceCents','assortmentStoreId','verification'])assert.equal(Object.hasOwn(p,forbidden),false);
  }
  assert.equal(C.householdWishes(wishes).length,0);
  const changedPack={...wish('glass-cleaner-spray'),pack:pack(1000)};
  assert.ok(C.householdWishes([changedPack]).some(p=>p.id===changedPack.id));
  const index=S.build(wishes,references);
  assert.equal(S.search(index,'klopapier').items[0].id,wish('toilet-paper-3ply').id);
  assert.equal(S.search(index,'spülmittel').items[0].id,wish('dishwashing-liquid').id);
  assert.ok(S.search(index,'Frosch Glasreiniger').items.length>=2);
  assert.ok(S.search(index,'Frosch Glasreiniger',{store:'selected-store'}).items.length>=2);
  const before=JSON.stringify([wishes,references]);
  C.householdWishes()[0].pack.min=1;C.referenceProducts()[0].aliases.push('changed');
  assert.equal(JSON.stringify([C.householdWishes(),C.referenceProducts()]),before);
  for(const p of [...wishes,...references])assert.deepEqual(S.restoreProduct({id:p.id,product:p},index),p);
});

test('paper matches require the same ply and an explicit complete-pack sheet count',()=>{
  const wanted=wish('toilet-paper-3ply');
  const valid=product('Toilettenpapier 3-lagig 8 × 150 Blatt',1200,'Blatt');
  assert.equal(match(wanted,valid),'group');
  assert.equal(match(wanted,product('Klopapier 3-lagig insgesamt 1200 Blatt',1200,'Blatt')),'group');
  for(const p of [
    product('Regina Toilettenpapier',150,'Blatt',{brand:'Regina'}),
    product('Toilettenpapier 3-lagig 150 Blatt',1200,'Blatt'),
    product('Toilettenpapier 4-lagig 8 × 150 Blatt',1200,'Blatt'),
    product('Toilettenpapier 3-lagig 8 × 200 Blatt',1600,'Blatt'),
    product('Toilettenpapier Recycling 3-lagig 8 × 150 Blatt',1200,'Blatt'),
    product('Feuchtes Toilettenpapier 3-lagig 8 × 150 Blatt',1200,'Blatt'),
    product('Toilettenpapier mit Duft 3-lagig 8 × 150 Blatt',1200,'Blatt'),
    product('Küchenpapier 3-lagig 8 × 150 Blatt',1200,'Blatt')
  ])assert.equal(match(wanted,p),'none',p.title);
  const inherited=product('Toilettenpapier',1200,'Blatt',{paperLayers:3,paperTotalSheets:1200,subtitle:'3-lagig · 8 × 150 Blatt'});
  assert.equal(match(wanted,inherited),'none','unconfirmed offer must not inherit catalogue-only ply/sheets');
  assert.equal(match(wanted,inherited,{paperLayers:3,paperTotalSheets:1200}),'group');
  assert.equal(match(wanted,valid,{paperLayers:4,paperTotalSheets:1200}),'none','contradictory ply is rejected');
  assert.equal(match(wanted,valid,{paperLayers:3,paperTotalSheets:600}),'none','contradictory total is rejected');
  assert.deepEqual(C.getChoice(wanted).product.pack,wanted.pack,'no pack-size widening for household items');
  const kitchen=product('Küchentücher 3-lagig 4 × 64 Blatt',256,'Blatt');
  assert.equal(match(wish('kitchen-paper-3ply'),kitchen),'group');
});

test('cleaners and everyday household consumables keep purpose, form, dimensions and exact pack',()=>{
  const examples=[
    ['glass-cleaner-spray','Glasreiniger Sprühflasche',500,'ml'],
    ['glass-cleaner-refill','Glasreiniger Nachfüllbeutel',1000,'ml'],
    ['all-purpose-cleaner-spray','Allzweckreiniger Spray',500,'ml'],
    ['dishwashing-liquid','Geschirrspülmittel flüssig',500,'ml'],
    ['liquid-soap-refill','Flüssigseife Nachfüllbeutel',500,'ml'],
    ['bin-bags-30l','Müllbeutel 30l',20,'St.'],
    ['baking-paper-sheets','Backpapier Zuschnitte 38 × 42 cm',20,'St.'],
    ['dishwashing-sponges','Spülschwämme',3,'St.'],
    ['dishwasher-tabs-classic','Geschirrspültabs Classic',40,'St.'],
    ['dishwasher-salt','Geschirrspülsalz',2000,'g']
  ];
  for(const [id,title,n,unit] of examples){
    assert.equal(match(wish(id),product(title,n,unit)),'group',title);
    assert.equal(match(wish(id),product(title,n+1,unit)),'none',title+' wrong size');
    assert.equal(match(wish(id),product(title+' Konzentrat',n,unit)),'none',title+' concentrate');
  }
  for(const title of ['Glasreiniger Nachfüllbeutel','Glasreiniger Konzentrat','Glasreiniger Antibakteriell Spray','Allzweckreiniger Spray','Glasreiniger oder Badreiniger Spray'])
    assert.equal(match(wish('glass-cleaner-spray'),product(title)),'none',title);
  assert.equal(match(wish('bin-bags-30l'),product('Müllbeutel 60 Liter',20,'St.')),'none');
  assert.equal(match(wish('baking-paper-sheets'),product('Backpapier Zuschnitte 42 × 45 cm',20,'St.')),'none');
  assert.equal(match(wish('dishwasher-tabs-classic'),product('Spülmaschinentabs All in 1',40,'St.')),'none');
  assert.equal(match(wish('dishwasher-salt'),product('Speisesalz',2000,'g')),'none');
});

test('Frosch references match only verified same-brand exact variants and format sizes',()=>{
  for(const reference of C.referenceProducts()){
    assert.equal(reference.referenceWish,true);assert.equal(reference.brand,'Frosch');
    assert.match(reference.manufacturerSourceUrl,/^https:\/\/frosch\.de\//);
    assert.equal(reference.manufacturerCheckedAt,'2026-10-20');
    const actual={...reference,id:'import:actual',variantId:'import:actual',groupId:'import:actual'};
    assert.equal(match(reference,actual),'exact',reference.title);
    assert.equal(match(reference,{...actual,brand:'Andere Marke',title:actual.title.replace('Frosch','Andere Marke')}),'none');
    assert.equal(match(reference,{...actual,pack:pack(reference.pack.min+50)}),'none');
    assert.equal(match(reference,{...actual,title:actual.title+' Konzentrat'}),'none');
    assert.equal(match(reference,{...actual,line:'Andere Rezeptur'}),'none');
    assert.equal(match(reference,actual,{packUnconfirmed:true}),'none');
    assert.equal(match(reference,actual,{verification:'unverified'}),'none');
  }
  const [spray,refill]=C.referenceProducts();
  assert.equal(match(spray,{...refill,id:'different-refill',variantId:'different-refill'}),'none');
  assert.equal(match(spray,product('Frosch Spiritus Glas-Reiniger',500,'ml',{brand:'Frosch'})),'exact');
  assert.equal(match(spray,product('Frosch Glasreiniger',500,'ml',{brand:'Frosch'})),'none');
  assert.equal(match(spray,product('Frosch Spiritus Glas-Reiniger 950 ml',500,'ml',{brand:'Frosch'})),'none');
});
