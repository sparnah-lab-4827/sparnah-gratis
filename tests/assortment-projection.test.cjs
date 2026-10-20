'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Stores=require('../site/stores.js'),S=require('../site/search.js'),C=require('../site/choices.js'),E=require('../site/engine.js');
const pack={min:500,max:500,unit:'g'},sku='000000000647983006';
const original={id:'assortment:aldi:'+sku+':fixture',retailerProductId:sku,title:'FROSTA Fertiggerichte, Butter Chicken 500 g',brand:'FROSTA',
 groupId:'assortment:aldi:'+sku,variantId:'assortment:aldi:'+sku,pack,
 assortmentStoreId:'aldi',assortmentSourceUrl:'https://www.aldi-sued.de/produkt/frosta-butter-chicken-500-g-'+sku,
 sourcePage:'https://www.aldi-sued.de/produkte/tiefkuehlung/k/1588161425467141?page=5',
 assortmentCheckedAt:'2026-10-20',availabilityConfirmed:false};
const manufacturer={id:'manufacturer:butter-chicken',title:'FRoSTA Butter Chicken',brand:'FRoSTA',groupId:'frosta-meals',
 variantId:'manufacturer:butter-chicken',line:'Standard',pack};
const catalog={stores:[
 {id:'aldi',name:'ALDI source branch',retailerId:'aldi',url:'https://www.aldi-sued.de/'},
 {id:'aldi-display',name:'ALDI chosen branch',retailerId:'aldi',url:'https://www.aldi-sued.de/',preferredDisplay:true},
 {id:'kaufland',name:'Kaufland',retailerId:'kaufland',url:'https://filiale.kaufland.de/'}
],offers:[]};
const assortment=products=>({sources:{aldi:{sourceUrl:'https://www.aldi-sued.de/produkte'}},products});
const view=()=>Stores.project(catalog,{enabledStores:['aldi','kaufland']},E);

test('audited public retailer catalogue projects only resolver snapshots and preserves all source evidence',()=>{
 const branch={...original,id:'branch-only',assortmentStoreId:'aldi-local'};
 const other={...original,id:'kaufland-product',assortmentStoreId:'kaufland'};
 const raw=assortment([original,branch,other]),before=JSON.stringify(raw),stores=view().catalog.stores;
 const projected=Stores.projectAssortment(raw,stores),p=projected.products[0];
 assert.equal(JSON.stringify(raw),before);assert.notEqual(p,original);
 assert.equal(p.assortmentStoreId,'aldi-display');assert.equal(p.assortmentSourceStoreId,'aldi');
 assert.equal(p.assortmentScope,'retailer-catalog');assert.equal(p.assortmentRetailerId,'aldi');
 for(const key of Object.keys(original).filter(k=>k!=='assortmentStoreId'))assert.deepEqual(p[key],original[key],key);
 assert.equal(projected.products[1],branch);assert.equal(projected.products[2],other);
 assert.equal(p.priceCents,undefined);assert.equal(p.verification,undefined);assert.equal(p.availabilityConfirmed,false);
 assert.deepEqual(Stores.projectAssortment(raw,stores),projected,'same input yields same derived snapshot');
 assert.deepEqual(Stores.projectAssortment(projected,stores),projected,'projection is idempotent');
});

test('unknown, branch-specific, localised or non-ALDI-SÜD records never acquire retailer-wide scope',()=>{
 const stores=view().catalog.stores;
 for(const extra of [
  {assortmentStoreId:'aldi-other'},{scope:'branch'},{assortmentScope:'branch'},{branchId:'one'},
  {assortmentBranchId:'one'},{storeId:'one'},{applicableStoreIds:['aldi']},{retailerId:'kaufland'},
  {availabilityConfirmed:true},{availabilityConfirmed:undefined},{retailerProductId:'wrong'},
  {id:'unreviewed-id'},{sourcePage:undefined},{sourcePage:'https://www.aldi-sued.de/produkte/tiefkuehlung/k/123?branch=one'},
  {sourcePage:'https://www.aldi-sued.de/produkte/tiefkuehlung/k/123?page=2&page=3'},
  {sourcePage:'https://www.aldi-sued.de/filialen/one'},
  {assortmentSourceUrl:original.assortmentSourceUrl+'?store=one'},
  {assortmentSourceUrl:original.assortmentSourceUrl.replace('aldi-sued','aldi-nord')},
  {assortmentSourceUrl:original.assortmentSourceUrl.replace('https:','http:')},
  {assortmentSourceUrl:original.assortmentSourceUrl.replace('https://','https://user:pass@')}
 ]){
  const p={...original,...extra};
  assert.equal(Stores.projectAssortment(assortment([p]),stores).products[0],p,JSON.stringify(extra));
 }
 for(const targetStores of [[],catalog.stores,[{...stores[0],retailerId:'aldi-nord'}],
  [{...stores[0],url:'https://www.aldi-nord.de/'}]]){
  const raw=assortment([original]);
  assert.equal(Stores.projectAssortment(raw,targetStores),raw,'missing, ambiguous or different chain stays unchanged');
 }
 const raw=assortment([original]);raw.sources.aldi.sourceUrl='https://www.aldi-sued.de/produkte?store=one';
 assert.equal(Stores.projectAssortment(raw,stores),raw);
});

test('projected retailer-catalogue identity reaches manufacturer hint and existing visit without price or stock inference',()=>{
 const projectedStores=view(),prepared=Stores.projectAssortment(assortment([original]),projectedStores.catalog.stores);
 const resolver=S.createAssortmentHints(prepared.products,{choices:C,products:[original,manufacturer],engine:E});
 const hints=resolver.assortmentHints(manufacturer,{storeIds:projectedStores.settings.enabledStores});
 assert.equal(hints.length,1);assert.equal(hints[0].storeId,'aldi-display');
 assert.equal(hints[0].products[0],prepared.products[0]);
 assert.deepEqual(resolver.assortmentHints({...manufacturer,pack:{min:800,max:800,unit:'g'}}),[]);
 const anchors=projectedStores.catalog.stores.map((store,i)=>({id:'anchor'+i,title:'Fixture '+i,groupId:'anchor'+i,
  variantId:'anchor'+i,pack,storeId:store.id}));
 const fixturePrices=anchors.map(p=>({id:p.id,title:p.title,storeId:p.storeId,groupIds:[p.groupId],variantIds:[p.variantId],
  pack,priceCents:100,verification:'household',start:'2026-10-20',end:'2026-10-20'}));
 const result=E.optimize([...anchors,manufacturer].map(product=>({id:product.id,product,qty:1})),fixturePrices,
  projectedStores.catalog.stores,{enabledStores:projectedStores.settings.enabledStores,maxStores:2,
   weekStart:'2026-10-19',notBefore:'2026-10-20',assortmentHints:new Map([[manufacturer.id,hints]]),assortmentMatcher:resolver.match});
 assert.equal(result.unknown[0].assignedStoreId,'aldi-display');assert.equal(result.unknown[0].assignmentKind,'assortment');
 assert.equal(result.coverage,2);assert.equal(result.total,200);assert.equal(result.complete,false);
});
