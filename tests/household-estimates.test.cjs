'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../site/estimates.js'),C=require('../site/choices.js'),E=require('../site/engine.js');
const references=require('../site/estimate-references.js');
const frosch=C.referenceProducts(),wishes=C.householdWishes();
const estimator=G.createEstimator([...frosch,...wishes]);
const pack=(n,unit='ml')=>({min:n,max:n,unit});
const product=(title,n=500,extra={})=>({id:'test:'+title,title,brand:'',category:'Haushalt',pack:pack(n),...extra});
const budget=(p,data=references)=>G.createEstimator([p],data).estimate(p);

test('all five researched Frosch variants use one matching dated reference, never an offer',()=>{
 const expected=[199,299,249,199,199];
 frosch.forEach((p,i)=>{
  const e=estimator.estimate(p);
  assert.ok(e,p.title);assert.equal(e.basis,'exact');assert.equal(e.referenceCents,expected[i]);
  assert.equal(e.referenceCount,1);assert.equal(e.referencePack.min,p.pack.min);
  assert.equal(e.scaled,false);assert.equal(e.reviewedAt,'2026-10-20');
  assert.equal(e.priceCents,undefined);assert.equal(e.storeId,undefined);assert.equal(E.offerUsable(e,1),false);
 });
});

test('household brand-agnostic wishes use labelled similar budgets and preserve reference packs',()=>{
 const values=[295,265,200,315,250,125,55,135,65,35,180,75];
 assert.equal(wishes.length,12);
 wishes.forEach((p,i)=>{
  const e=estimator.estimate(p);
  assert.ok(e,p.title);assert.equal(e.basis,'similar');assert.equal(e.cents,values[i],p.title);
  assert.match(e.explanation,/kein Preisnachweis/);
 });
 const refill=estimator.estimate(wishes.find(p=>p.title==='Glasreiniger Nachfüllpack'));
 assert.equal(refill.referencePack.min,950);assert.equal(refill.pack.min,1000);assert.equal(refill.scaled,true);
 assert.match(refill.explanation,/proportional.*950 ml/);
 const paper=estimator.estimate(wishes.find(p=>p.title.startsWith('Backpapier')));
 assert.equal(paper.referencePack.min,30);assert.equal(paper.pack.min,20);assert.equal(paper.scaled,true);
});

test('spray, bottle, refill and concentrate cannot borrow each other’s references',()=>{
 for(const p of [
  product('Glasreiniger Konzentrat Spray'),product('Glasreiniger Flasche'),
  product('Glasreiniger hochkonzentriert Spray'),
  product('Glasreiniger Spray',500,{concentrated:true}),
  product('Glasreiniger Spray',500,{productForm:'Spray hochkonzentriert'}),
  product('Allzweckreiniger Nachfüllpack'),product('Allzweckreiniger Konzentrat'),
  product('Frosch Essig Reiniger Spray',1000,{brand:'Frosch'}),
  product('Neutral Reiniger Nachfüllbeutel',1000,{brand:'Frosch'}),
  product('Flüssigseife Pumpspender'),product('Festes Shampoo',300,{pack:pack(300,'g')}),
  product('Spülmaschinen-Tabs All in one',40,{pack:pack(40,'St.')})
 ])assert.equal(budget(p),null,p.title);
 const spray=frosch[0],reused=G.createEstimator([spray]);
 assert.ok(reused.estimate(spray));
 assert.equal(reused.estimate({...spray,productForm:'Flasche'}),null,'changed productForm is part of cache identity');
});

test('paper types, layers, roll counts and sheets remain distinct',()=>{
 const p=wishes[0];
 assert.equal(budget({...p,title:'Toilettenpapier 4-lagig',paperLayers:4}),null);
 const toilet=budget(p),kitchen=budget(wishes[1]);
 assert.notEqual(toilet.id,kitchen.id);assert.equal(toilet.pack.unit,'Blatt');assert.equal(kitchen.pack.unit,'Blatt');
 const wrongOnly={entries:references.entries.filter(r=>r.id==='guide-kuechenrollen-blatt')};
 assert.equal(budget(p,wrongOnly),null);
 const rollsOnly={entries:references.entries.filter(r=>r.id==='guide-toilettenpapier-recycling')};
 assert.equal(budget(p,rollsOnly),null);
});

test('nonfood measurements never become edible vinegar, salt or diaper body-weight budgets',()=>{
 for(const p of [
  product('Windeln 4–9 kg',null,{pack:undefined}),
  product('Windeln 4–9 kg',6000,{pack:pack(6000,'g')}),
  product('Müllbeutel 60 Liter',20,{pack:pack(20,'St.')}),
  product('Backpapier Zuschnitte 20 × 30 cm',20,{pack:pack(20,'St.')}),
  product('Backpapier Rolle',1,{pack:pack(1,'St.')})
 ])assert.equal(budget(p),null,p.title);
 for(const title of ['Müllbeutel 30 Liter','Müllbeutel 30 l']){
  const e=budget(product(title,null,{pack:undefined}));
  assert.equal(e.pack.unit,'St.');assert.equal(e.pack.min,20);assert.equal(e.assumedPack,true);
 }
 const cleaner=product('Essig Reiniger',1000,{brand:'Frosch'});
 const foodOnly={entries:references.entries.filter(r=>/essig|salz/i.test(r.label)&&!householdReference(r))};
 assert.equal(budget(cleaner,foodOnly),null);
 assert.equal(budget(product('Spülmaschinensalz',2000,{pack:pack(2000,'g')}),foodOnly),null);
 function householdReference(r){return /haushalt|drogerie/i.test(r.category);}
});

test('shampoo and toothpaste retain separate families and unsupported products stay open',()=>{
 for(const [p,cents] of [
  [product('Shampoo',300,{category:'Drogerie',isGroupChoice:true}),65],
  [product('Zahnpasta',125,{category:'Drogerie',isGroupChoice:true}),55]
 ]){const e=budget(p);assert.equal(e.cents,cents);assert.equal(e.basis,'similar');}
 assert.equal(budget(product('Spezialpflege ohne Produktart',500,{category:'Drogerie'})),null);
 const unknown=product('Badreiniger Spray');
 assert.equal(budget(unknown),null);
 const noRefs=G.createEstimator([wishes[0],frosch[0]],{entries:[]});
 assert.equal(noRefs.estimate(wishes[0]),null);assert.equal(noRefs.estimate(frosch[0]),null);
});
