'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../site/choices.js'),E=require('../site/engine.js'),S=require('../site/selection.js');
const pack=n=>({min:n,max:n,unit:'g'});
const original={id:'spread',title:'Nutella',brand:'Ferrero',groupId:'spread',variantId:'spread450',pack:pack(450)};
const own={id:'own-spread',title:'House Nuss-Nougat-Creme',brand:'House',groupId:'house',variantId:'house400',pack:pack(400)};
const products=[original,own];
const raw=(p,price,extra={})=>({id:p.id,productId:p.id,title:p.title,brand:p.brand,groupIds:[p.groupId],variantIds:[p.variantId],pack:p.pack,priceCents:price,storeId:'a',verification:'source',start:'2026-10-19',end:'2026-10-24',...extra});
const settings={enabledStores:['a','b'],weekStart:'2026-10-19',notBefore:'2026-10-19',maxStores:1};
const stores=[{id:'a',name:'A'},{id:'b',name:'B'}];
function plan(offers,product=original,qty=1,options={}){return E.optimize([{id:product.id,qty,product:C.getChoice(product,products).product,requestedProduct:product}],C.annotateOffers(offers,products),stores,{...settings,...options});}

test('opt-in switches to a cheaper own-label spread with similar size and preserves the saved choice',()=>{
 const before=JSON.stringify(products),offers=[raw(original,399),raw(own,199)],p=plan(offers);
 assert.equal(p.lines[0].offer.productId,own.id);assert.equal(p.total,199);assert.equal(p.lines[0].offer.pack.min,400);
 assert.equal(S.chosenProduct(p.lines[0].item.product,p.lines[0].offer,products).title,own.title);
 const exact=E.optimize([{id:original.id,product:original,qty:1}],C.annotateOffers(offers,products),stores,settings);
 assert.equal(exact.total,399);assert.equal(exact.lines[0].offer.productId,original.id);assert.equal(JSON.stringify(products),before);
});
test('a cheaper jar is rejected when its kilo price is higher',()=>{
 const p=plan([raw(original,210),raw(own,199)]); // 4.67/kg beats 4.98/kg.
 assert.equal(p.lines[0].offer.productId,original.id);assert.equal(p.total,210);
 const matches=E.bestOffers(C.getChoice(original,products).product,C.annotateOffers([raw(original,210),raw(own,199)],products),settings);
 assert.equal(matches[0].offer.productId,original.id);
});
test('lower kilo price wins across shops even when a larger jar costs more; payable totals are real',()=>{
 const larger={...own,pack:pack(500)},p=plan([raw(original,210),raw(larger,220,{storeId:'b',depositCents:10})],original,3);
 assert.equal(p.visits[0].store.id,'b');assert.equal(p.total,660);assert.equal(p.deposit,30);
 assert.equal(p.extraStoreSavings,null);assert.equal(p.unitComparisons,true);
 assert.equal(p.lines[0].item.qty,3);assert.equal(p.lines[0].offer.pack.min,500);
});
test('strict pack boundary, dietary variants and unrelated products cannot become alternatives',()=>{
 const chosen=C.getChoice(original,products).product;
 for(const size of [350,550])assert.equal(plan([raw({...own,pack:pack(size)},99)]).coverage,0);
 for(const title of ['Nutella Kekse','Nutella Eis','Nutella Plant Based','Nuss-Nougat-Creme Croissant','Nuss-Nougat Eis','Haselnussmus','Erdnussbutter','Bio Nuss-Nougat-Creme','Vegane Nuss-Nougat-Creme']){
  const o=raw({...own,title},99);assert.equal(E.match(chosen,C.annotateOffers([o],products)[0]).status,'none',title);
 }
 assert.equal(plan([raw(own,99,{packUnconfirmed:true})]).coverage,0);
});
test('excluded stores, expired prices, coupons and quantity limits still apply',()=>{
 for(const extra of [{storeId:'c'},{end:'2026-10-18'},{requiresCard:true},{requiresApp:true},{verification:'unverified'},{minQty:2},{maxQty:1}]){
  assert.equal(plan([raw(own,99,extra)],original,extra.maxQty?2:1).coverage,0,JSON.stringify(extra));
 }
 assert.equal(plan([raw(own,99,{storeId:'b'})],original,1,{targetStoreId:'a'}).coverage,0);
});
test('precise pasta and rice types allow brands but do not swap recipes or shapes',()=>{
 for(const title of ['Spaghetti','Basmati Reis']){
  const a={...original,title:'Brand A '+title,brand:'Brand A',pack:pack(500)},b={...own,title:'House '+title,pack:pack(500)};
  const ps=[a,b],want=C.getChoice(a,ps).product;
  assert.equal(E.match(want,C.annotateOffers([raw(b,99)],ps)[0]).status,'group');
  for(const other of ['Spaghetti Bolognese','Fusilli','Vollkornreis','Milchreis mit Zimt'])assert.equal(E.match(want,C.annotateOffers([raw({...b,title:'House '+other},99)],ps)[0]).status,'none');
 }
});

test('own-label comparisons cover multiple food and drink families using kg or litre prices',()=>{
 const pairs=[
  ['Weizenmehl Type 405','Qualitäts-Weizenmehl Type 405','g'],['Dinkelvollkornmehl','Dinkelmehl Vollkorn','g'],
  ['Puderzucker','Puderzucker','g'],['Zarte Haferflocken','Haferflocken Feinblatt','g'],
  ['Passierte Tomaten','Passata','g'],['Gehackte Tomaten','Tomatenstücke','g'],
  ['Naturjoghurt 3,5% Fett','Joghurt 3.5% Fett milder Naturjoghurt','g'],
  ['Magerquark','Magerquark','g'],['Filterkaffee','Gemahlener Kaffee','g'],
  ['Kaffeebohnen Espresso','Ganze Bohne Espresso','g'],['Rote Linsen','Rote Linsen','g'],
  ['Erdnussbutter cremig','Erdnussbutter cremig','g'],['Gouda gerieben','Gouda gerieben','g'],
  ['Tomatenketchup','Tomaten-Ketchup','ml'],['Sonnenblumenöl','Sonnenblumenöl','ml'],
  ['Natürliches Mineralwasser Classic','Mineralwasser Klassik','ml'],
  ['Apfelsaft naturtrüb','Apfelsaft naturtrüb','ml'],['Haferdrink ungesüßt','Haferdrink ungesüßt','ml'],
  ['Apfelessig','Apfelessig','ml'],
  ['Hähnchenbrustfilet frisch','Hähnchenbrustfilet frisch','g'],['Pizza Margherita','Pizza Margherita','g'],
  ['Äpfel Elstar','Äpfel Elstar','g'],['Kidneybohnen in der Dose','Kidneybohnen in der Dose','g'],
 ];
 for(const [aTitle,bTitle,unit] of pairs){
  const a={...original,title:'Brand A '+aTitle,brand:'Brand A',pack:{...pack(500),unit}};
  const b={...own,title:'House '+bTitle,pack:{...pack(450),unit}},ps=[a,b],want=C.getChoice(a,ps);
  assert.equal(want.kind,'alternative',aTitle);
  const p=E.optimize([{id:'wish',qty:2,product:want.product,requestedProduct:a}],C.annotateOffers([raw(a,200),raw(b,150)],ps),stores,settings);
  assert.equal(p.lines[0].offer.productId,b.id,aTitle);assert.equal(p.total,300);
  assert.equal(E.unitPrice(p.lines[0].offer),unit==='g'?'3,33 € / kg':'3,33 € / l');
  assert.equal(p.cheaperAlternativeCount,1);assert.ok(p.lines[0].unitSaving.percent>16);
 }
});

test('properties, preparation, recipes, units and ambiguous selections stay separate',()=>{
 const pairs=[['Weizenmehl Type 405','Weizenmehl Type 550'],['Weizenmehl Type 405','Dinkelmehl Type 405'],
 ['Puderzucker','Vanillinzucker'],['Zarte Haferflocken','Kernige Haferflocken'],
 ['Passierte Tomaten','Tomate frito passierte Tomaten'],['Passierte Tomaten','Passierte Tomaten Basilikum'],
 ['Naturjoghurt 3.5% Fett','Naturjoghurt 1.5% Fett'],['Naturjoghurt 3.5% Fett','Erdbeerjoghurt 3.5% Fett'],
 ['Filterkaffee','Kaffeebohnen'],['Filterkaffee','Filterkaffee entkoffeiniert'],
 ['Tomatenketchup','Ketchup, Mayonnaise oder Sauce'],['Sonnenblumenöl','Thunfisch in Sonnenblumenöl'],
 ['Mineralwasser Classic','Mineralwasser Medium'],['Mineralwasser Still','Mineralwasser Lemon'],
 ['Apfelsaft','Apfelnektar'],['Haferdrink','Haferdrink Barista'],['Erdnussbutter cremig','Erdnussbutter stückig']];
 pairs.push(['Hähnchenbrustfilet frisch','Hähnchenbrustfilet mariniert'],['Pizza Margherita','Pizza Salami'],['Äpfel Elstar','Äpfel Gala'],['Kidneybohnen in der Dose','Kidneybohnen getrocknet']);
 for(const [aTitle,bTitle] of pairs){
  const unit=/ketchup|ol|öl|wasser|saft|drink/i.test(aTitle)?'ml':'g';
  const a={...original,title:'Brand A '+aTitle,brand:'Brand A',pack:{...pack(500),unit}},b={...own,title:'House '+bTitle,pack:a.pack},ps=[a,b];
  assert.equal(E.match(C.getChoice(a,ps).product,C.annotateOffers([raw(b,99)],ps)[0]).status,'none',aTitle+' / '+bTitle);
 }
 for(const change of [{bio:true},{vegan:true},{glutenFree:true},{lactoseFree:true},{pack:{...pack(450),unit:'ml'}}]){
  assert.equal(plan([raw({...own,...change},99,change)]).coverage,0,JSON.stringify(change));
 }
});

test('unit savings need current original prices in the same shop and are separate from retailer discounts',()=>{
 const p=plan([raw(original,399),raw(own,199)]);
 assert.equal(p.referenceSavings,null);assert.equal(p.cheaperAlternativeCount,1);
 assert.equal(p.lines[0].unitSaving.originalOffer.productId,original.id);
 assert.ok(Math.abs(p.lines[0].unitSaving.percent-43.890977443609)<0.000001);
 for(const baseline of [null,{storeId:'b'},{end:'2026-10-18'},{requiresCard:true},{verification:'unverified'},{packUnconfirmed:true},{start:'2026-10-20',end:'2026-10-20'}]){
  const offers=[raw(own,199,{end:'2026-10-19'}),...(baseline?[raw(original,399,baseline)]:[])];
  const result=plan(offers);assert.equal(result.cheaperAlternativeCount,0,JSON.stringify(baseline));assert.equal(result.lines[0].unitSaving,undefined);
 }
 const equal=plan([raw(original,450),raw(own,400)]);
 assert.equal(equal.cheaperAlternativeCount,0);assert.equal(equal.referenceSavings,null);
 const discount=plan([raw(original,399),raw(own,199,{referencePriceCents:249})],original,2);
 assert.equal(discount.referenceSavings,100);assert.equal(discount.cheaperAlternativeCount,1);
});
