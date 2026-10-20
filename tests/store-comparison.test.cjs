'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../site/engine.js');
const stores=[{id:'aldi',name:'ALDI'},{id:'kaufland',name:'Kaufland'},{id:'rewe',name:'REWE'}];
const product={id:'wanted',title:'Produkt',groupId:'family',variantId:'variant',pack:{min:500,max:500,unit:'g'}};
const options={weekStart:'2026-10-19',notBefore:'2026-10-20',enabledStores:['aldi','kaufland'],quantity:1};
const offer=(id,storeId,priceCents,extra={})=>({id,storeId,priceCents,productId:product.id,title:product.title,groupIds:['family'],variantIds:['variant'],
  pack:{...product.pack},verification:'source',priceKind:'promotion',start:'2026-10-19',end:'2026-10-24',...extra});

test('product comparison sees cheaper selected stores independently of the basket target and shop limit',()=>{
  const prices=[offer('aldi-normal','aldi',299,{priceKind:'regular'}),offer('kaufland-promotion','kaufland',199)];
  const before=JSON.stringify(prices),settings={...options,targetStoreId:'aldi',maxStores:1};
  const basket=E.optimize([{id:product.id,product,qty:1}],prices,stores,settings);
  assert.equal(basket.lines[0].storeId,'aldi');
  const compared=E.compareStores(product,prices,stores,settings);
  assert.equal(compared.best.storeId,'kaufland');assert.equal(compared.best.cost,199);
  assert.deepEqual(compared.ranked.map(row=>row.storeId),['kaufland','aldi']);
  assert.deepEqual(compared.missingStoreIds,[]);
  assert.equal(compared.hasPriceForEverySelectedStore,true);
  assert.equal(compared.coverageState,'all-selected');
  assert.equal(compared.scope,'recorded-selected-store-prices');
  assert.equal(JSON.stringify(prices),before);
});

test('a genuinely lower normal price beats a higher promotion and the best price is retained once per shop',()=>{
  const prices=[offer('normal','aldi',149,{priceKind:'regular'}),offer('promotion','aldi',199),
    offer('other-promotion','kaufland',179),offer('other-old-normal','kaufland',169,{priceKind:'regular'})];
  const result=E.compareStores(product,prices,stores,options);
  assert.equal(result.best.offer.id,'normal');assert.equal(result.ranked.length,2);
  assert.equal(result.ranked[1].offer.id,'other-old-normal');
  assert.equal(result.best.match,'exact');assert.equal(result.best.future,false);
});

test('the comparison excludes unselected, expired, uncertain, membership and wrong-quantity prices',()=>{
  const invalid=[
    offer('unselected','rewe',1),
    offer('expired','aldi',1,{end:'2026-10-19'}),
    offer('next-week','aldi',1,{start:'2026-10-26',end:'2026-10-31'}),
    offer('no-end-expired','aldi',1,{end:null}),
    offer('unverified','aldi',1,{verification:'unverified'}),
    offer('card','aldi',1,{requiresCard:true}),offer('app','aldi',1,{requiresApp:true}),
    offer('minqty','aldi',1,{minQty:2}),offer('maxqty','aldi',1,{maxQty:0.5}),
    offer('wrong-variant','aldi',1,{variantIds:['other']}),
    offer('unknown-variant','aldi',1,{variantIds:null}),
    offer('unconfirmed-pack','aldi',1,{packUnconfirmed:true}),
    offer('missing-pack','aldi',1,{pack:null}),
    offer('wrong-pack','aldi',1,{pack:{min:400,max:400,unit:'g'}}),
    offer('range-pack','aldi',1,{pack:{min:400,max:600,unit:'g'}}),
    offer('unknown-price','aldi',null)
  ];
  const result=E.compareStores(product,[...invalid,offer('valid','kaufland',249)],stores,options);
  assert.equal(result.best.offer.id,'valid');assert.equal(result.ranked.length,1);
  assert.deepEqual(result.missingStoreIds,['aldi']);assert.equal(result.coverageState,'partial');
  assert.equal(result.hasPriceForEverySelectedStore,false);
  const none=E.compareStores(product,invalid,stores,options);
  assert.equal(none.best,null);assert.equal(none.coverageState,'none');
  assert.deepEqual(none.missingStoreIds,['aldi','kaufland']);
});

test('future offers and temporary closures expose the first actually valid open shopping day',()=>{
  const altered=stores.map(store=>({...store,...(store.id==='aldi'?{closedDates:['2026-10-20'],temporaryClosureFrom:'2026-10-21',temporaryClosureUntil:'2026-10-22'}:{})}));
  const prices=[offer('future','aldi',99,{start:'2026-10-21'}),offer('current','kaufland',199)];
  const result=E.compareStores(product,prices,altered,options);
  assert.equal(result.best.offer.id,'future');assert.equal(result.best.day,'2026-10-23');assert.equal(result.best.future,true);
  assert.deepEqual(result.best.validDays,['2026-10-23','2026-10-24']);
  assert.equal(result.ranked[1].day,'2026-10-20');assert.equal(result.ranked[1].future,false);
  const closed=stores.map(store=>({...store,...(store.id==='aldi'?{temporaryClosureUntil:'2026-10-24'}:{})}));
  const result2=E.compareStores(product,prices,closed,options);
  assert.equal(result2.best.storeId,'kaufland');
  assert.deepEqual(result2.closedStoreIds,['aldi']);assert.deepEqual(result2.missingStoreIds,['aldi']);
  assert.equal(E.compareStores(product,[offer('ends-before-reopening','aldi',1,{end:'2026-10-22'})],altered,options).best,null);
});

test('equal prices keep every winning store without depending on input order or promotion labels',()=>{
  const prices=[offer('b','kaufland',199,{priceKind:'regular'}),offer('a','aldi',199)];
  const result=E.compareStores(product,prices,stores,options);
  assert.deepEqual(result.ties.map(row=>row.storeId),['aldi','kaufland']);
  assert.equal(result.best.storeId,'aldi');
  assert.deepEqual(E.compareStores(product,prices.toReversed(),stores.toReversed(),options).ranked,result.ranked);
  const sameShop=[offer('z','aldi',199),offer('a','aldi',199,{priceKind:'regular'})];
  assert.equal(E.compareStores(product,sameShop,stores,options).best.offer.id,'a');
});

test('chosen alternatives compare real unit prices while reporting actual checkout totals',()=>{
  const alternative={...product,variantId:null,compareByUnit:true,referencePack:product.pack,pack:{min:400,max:600,unit:'g'}};
  const prices=[offer('small','aldi',199,{pack:{min:400,max:400,unit:'g'}}),
    offer('large','kaufland',219,{pack:{min:600,max:600,unit:'g'},priceKind:'regular'})];
  const result=E.compareStores(alternative,prices,stores,{...options,quantity:2});
  assert.equal(result.comparisonBasis,'unit');
  assert.equal(result.best.offer.id,'large');assert.equal(result.best.cost,438);
  assert.equal(result.best.compareCost,365);
  assert.equal(result.best.match,'group');
  const ties=E.compareStores(alternative,[offer('a','aldi',200,{pack:{min:400,max:400,unit:'g'}}),
    offer('b','kaufland',300,{pack:{min:600,max:600,unit:'g'}})],stores,options);
  assert.equal(ties.ties.length,2,'same unit price is a tie despite different pack totals');
});

test('existing broad pack wishes use a common unit without enabling broader substitutions',()=>{
  for (const unit of ['g','ml','Blatt','St.','Wl']) {
    const broad={...product,variantId:null,pack:{min:400,max:600,unit}};
    const prices=[offer('smaller','aldi',199,{pack:{min:400,max:400,unit}}),
      offer('larger','kaufland',219,{pack:{min:600,max:600,unit}}),
      offer('outside-wish','kaufland',100,{pack:{min:1000,max:1000,unit}}),
      offer('different-type','aldi',1,{groupIds:['another-family'],pack:{min:600,max:600,unit}})];
    const result=E.compareStores(broad,prices,stores,options);
    assert.equal(result.best.offer.id,'larger',unit);
    assert.equal(result.best.cost,219);assert.equal(result.comparisonBasis,'unit');
    assert.equal(broad.compareByUnit,undefined,'saved preference is not changed');
  }
});

test('a sizeless wish compares only a common unit and never equates grams with millilitres',()=>{
  const sizeless={...product,pack:null,variantId:null};
  const sameUnit=[offer('small','aldi',199,{pack:{min:400,max:400,unit:'g'}}),
    offer('large','kaufland',219,{pack:{min:600,max:600,unit:'g'}})];
  assert.equal(E.compareStores(sizeless,sameUnit,stores,options).best.offer.id,'large');
  const incompatible=[sameUnit[0],{...sameUnit[1],pack:{min:600,max:600,unit:'ml'}}];
  const result=E.compareStores(sizeless,incompatible,stores,options);
  assert.equal(result.best,null);assert.equal(result.coverageState,'none');
  assert.deepEqual(result.missingStoreIds,['aldi','kaufland']);
});

test('the basket also compares an existing 450–500 g FRoSTA wish by kilo without an opt-in flag',()=>{
  const frosta={...product,title:'FRoSTA Fertiggericht',brand:'FRoSTA',variantId:null,pack:{min:450,max:500,unit:'g'}};
  const prices=[offer('450g','aldi',199,{pack:{min:450,max:450,unit:'g'}}),
    offer('500g','kaufland',219,{pack:{min:500,max:500,unit:'g'}})];
  const before=JSON.stringify(frosta),items=[{id:frosta.id,product:frosta,qty:2}];
  const result=E.optimize(items,prices,stores,{...options,maxStores:1});
  assert.equal(result.lines[0].offer.id,'500g');
  assert.equal(result.total,438,'actual checkout total is not normalized down to 450 g');
  assert.equal(result.unitComparisons,true);assert.equal(result.extraStoreSavings,null);
  assert.equal(E.bestOffers(frosta,prices,options)[0].offer.id,'500g');
  assert.equal(JSON.stringify(frosta),before);
  const fixed={...frosta,pack:{min:450,max:450,unit:'g'}};
  const exact=E.optimize([{id:fixed.id,product:fixed,qty:2}],prices,stores,options);
  assert.equal(exact.lines[0].offer.id,'450g');assert.equal(exact.total,398);
  assert.equal(exact.unitComparisons,false,'fixed exact selections remain fixed');
  const unchecked=E.optimize(items,[prices[0],{...prices[1],packUnconfirmed:true}],stores,options);
  assert.equal(unchecked.lines[0].offer.id,'450g','unconfirmed quantity cannot win by calculated kilo price');
});

test('a multi-store basket never labels differing allowed quantities as guaranteed money savings',()=>{
  const broad={...product,variantId:null,pack:{min:450,max:500,unit:'g'}};
  const second={id:'second',groupId:'second',variantId:'second',pack:{min:1,max:1,unit:'St.'}};
  const prices=[offer('450g','aldi',199,{pack:{min:450,max:450,unit:'g'}}),
    offer('500g','kaufland',219,{pack:{min:500,max:500,unit:'g'}}),
    offer('other','aldi',100,{productId:'second',groupIds:['second'],variantIds:['second'],pack:second.pack})];
  const result=E.optimize([{id:broad.id,product:broad,qty:1},{id:second.id,product:second,qty:1}],prices,stores,{...options,maxStores:2});
  assert.equal(result.coverage,2);assert.equal(result.total,319);assert.equal(result.visits.length,2);
  assert.equal(result.unitComparisons,true);assert.equal(result.extraStoreSavings,null);
});

test('unknown units do not acquire an invented conversion or a unit-price promise',()=>{
  const unknown={...product,variantId:null,pack:{min:2,max:3,unit:'unknown'}};
  const prices=[offer('smaller','aldi',199,{pack:{min:2,max:2,unit:'unknown'}}),
    offer('larger','kaufland',219,{pack:{min:3,max:3,unit:'unknown'}})];
  const plan=E.optimize([{id:unknown.id,product:unknown,qty:1}],prices,stores,options);
  assert.equal(plan.lines[0].offer.id,'smaller');assert.equal(plan.lines[0].compareCost,199);
  assert.equal(plan.unitComparisons,false);
  assert.equal(E.compareStores(unknown,prices,stores,options).best,null);
  const invalidReference={...unknown,compareByUnit:true,referencePack:{min:2,max:2,unit:'unknown'}};
  assert.equal(E.bestOffers(invalidReference,prices,options)[0].offer.id,'smaller');
});

test('unit savings against the original product require a real original price in the same store and day',()=>{
  const original={...product,groupId:'original-family'};
  const alternative={...product,variantId:null,compareByUnit:true,referencePack:product.pack,pack:{min:400,max:600,unit:'g'}};
  const prices=[offer('alternative','aldi',199,{pack:{min:400,max:400,unit:'g'}}),
    offer('original-other-store','kaufland',499,{groupIds:['original-family']}),
    offer('original-expired','aldi',399,{groupIds:['original-family'],end:'2026-10-19'})];
  const without=E.compareStores(alternative,prices,stores,{...options,requestedProduct:original});
  assert.equal(without.best.unitSaving,undefined);
  const known=offer('original-confirmed','aldi',399,{groupIds:['original-family']});
  const withOriginal=E.compareStores(alternative,[...prices,known],stores,{...options,requestedProduct:original});
  assert.equal(withOriginal.best.unitSaving.originalOffer.id,known.id);
  assert.ok(withOriginal.best.unitSaving.percent>37&&withOriginal.best.unitSaving.percent<38);
  const future=E.compareStores(alternative,[...prices,{...known,start:'2026-10-21'}],stores,{...options,requestedProduct:original});
  assert.equal(future.best.unitSaving,undefined,'tomorrow’s original price is not evidence for today');
});

test('no subscriptions, unknown selected stores and unusable quantities never imply complete coverage',()=>{
  const prices=[offer('a','aldi',199)];
  for(const settings of [{...options,enabledStores:[]},{...options,quantity:0},{...options,quantity:1.5}]){
    const result=E.compareStores(product,prices,stores,settings);
    assert.equal(result.best,null);assert.equal(result.hasPriceForEverySelectedStore,false);
  }
  const unknown=E.compareStores(product,prices,stores,{...options,enabledStores:['aldi','unknown']});
  assert.deepEqual(unknown.missingStoreIds,['unknown']);assert.equal(unknown.coverageState,'partial');
  assert.equal(E.compareStores(product,prices,stores,{...options,enabledStores:undefined,storeIds:['aldi']}).coverageState,'all-selected');
  const elapsed=E.compareStores(product,prices,stores,{...options,notBefore:'2026-10-25'});
  assert.equal(elapsed.best,null);assert.deepEqual(elapsed.closedStoreIds,[],'elapsed planning days do not prove store closures');
});
