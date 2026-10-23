'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../site/choices.js'),E=require('../site/engine.js');
const pack=n=>({min:n,max:n,unit:'g'});
const catalog={id:'assortment:aldi:nutella',groupId:'assortment:aldi:nutella',variantId:'assortment:aldi:nutella',title:'FERRERO Nutella 450 g',brand:'FERRERO',pack:pack(450)};
const reference={id:'nutella',groupId:'nutella',variantId:'nutella-450',title:'Nutella',brand:'Ferrero',pack:pack(450)};
const imported={id:'import:lidl:nutella',groupId:'auto:nutella',variantId:null,title:'Nutella',brand:'Nutella',pack:pack(450)};
const products=[catalog,reference,imported];
const raw=(extra={})=>({id:'lidl-price',productId:imported.id,title:'Nutella',brand:'Nutella',pack:pack(450),
 groupIds:[imported.groupId,reference.groupId],variantIds:[reference.variantId],storeId:'lidl',priceCents:399,
 start:'2026-10-19',end:'2026-10-24',verification:'source',...extra});
const options={weekStart:'2026-10-19',notBefore:'2026-10-23',storeIds:['aldi','lidl']};

test('the same original Nutella jar finds its current price across retailer catalogue IDs',()=>{
 const original=JSON.stringify(products),offers=[raw(),raw({id:'aldi-old',productId:catalog.id,storeId:'aldi',title:catalog.title,
  brand:catalog.brand,priceCents:349,end:'2026-10-22',groupIds:[catalog.groupId,reference.groupId],variantIds:[catalog.variantId,reference.variantId]})];
 const before=JSON.stringify(offers),annotated=C.annotateOffers(offers,products);
 for(const wanted of products){
  const comparison=E.compareStores(wanted,annotated,[{id:'aldi'},{id:'lidl'}],options);
  assert.equal(comparison.best.offer.id,'lidl-price',wanted.title);
  assert.equal(comparison.best.offer.priceCents,399);
  assert.equal(E.match(wanted,annotated[0]).status,wanted.variantId?'exact':'group');
 }
 const plan=E.optimize([{id:catalog.id,product:catalog,qty:2}],annotated,[{id:'aldi'},{id:'lidl'}],{...options,maxStores:1});
 assert.equal(plan.total,798);assert.equal(plan.lines[0].offer.id,'lidl-price');
 assert.deepEqual(C.annotateOffers(annotated,products),annotated);
 assert.equal(JSON.stringify(products),original);assert.equal(JSON.stringify(offers),before);
 assert.equal(C.getChoice(catalog,products).kind,'alternative','own-brand substitution remains opt-in and distinct');
});

test('original Nutella aliases do not bridge snacks, special recipes, unknown packs or other brands',()=>{
 for(const extra of [
  {title:'Nutella Biscuits'}, {title:'Nutella B-ready'}, {title:'Nutella Plant Based'}, {title:'Nutella Protein'},
  {title:'Nutella und go'}, {title:'Nutella oder Nuss-Nougat-Creme'}, {title:'Nutella',brand:'Other'},
  {title:'Nutella 800 g'}, {pack:pack(800)}, {pack:{min:400,max:450,unit:'g'}}, {pack:pack(450),packUnconfirmed:true},
  {title:'Nutella 2 × 450 g'}, {title:'Nutella 750 + 75 g'}, {title:'Nutella',line:'Plant Based'},
  {title:'Nutella',vegan:true}, {title:'Nutella',bio:true}, {title:'Nutella',lactoseFree:true},
  {title:'Nutella',groupSelection:true}, {title:'Nutella',isGroupChoice:true},
  {title:'Nuss-Nougat-Creme',brand:'House'}, {verification:'unconfirmed'}
 ]){
  const [annotated]=C.annotateOffers([raw(extra)],products);
  assert.equal(E.match(catalog,annotated).status,'none',JSON.stringify(extra));
  assert.ok(!annotated.variantIds.includes(catalog.variantId),JSON.stringify(extra));
 }
});

test('invalid saved catalogue identities cannot grant an exact Nutella match in reverse',()=>{
 for(const extra of [{title:'Nutella Biscuits'},{title:'Nutella 800 g'},{pack:pack(800)},{brand:'Other'},
  {title:'Nutella 2 x 450 g'},{line:'High Protein'},{vegan:true},{packUnconfirmed:true}]){
  const wanted={...catalog,...extra},[annotated]=C.annotateOffers([raw()],[wanted,reference,imported]);
  assert.equal(E.match(wanted,annotated).status,'none',JSON.stringify(extra));
 }
});
