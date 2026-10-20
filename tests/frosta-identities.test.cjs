'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../site/choices.js'),E=require('../site/engine.js');
const pack=n=>({min:n,max:n,unit:'g'});
const names=[
 ['bami','Bami Goreng','Bami Goreng',500],
 ['butter','Butter Chicken','Butter Chicken',500],
 ['fricassee','Hühnerfrikassee','Hühner Frikassee',500],
 ['potato','Bratkartoffelpfanne mit Hähnchen','Bratkartoffel Hähnchen Pfanne',500],
 ['salmon','Pasta Wildlachs','Pasta Wildlachs',450]
];
const retailers=names.map(([id,title,,n])=>({id:'assortment:aldi:'+id,title:`FROSTA Fertiggerichte, ${title} ${n} g`,
 brand:'FROSTA',groupId:'assortment:aldi:'+id,variantId:'assortment:aldi:'+id,pack:pack(n)}));
const manufacturers=names.map(([id,,title,n])=>({id:'manufacturer:'+id,title:'FRoSTA '+title,brand:'FRoSTA',
 groupId:'frosta-meals',variantId:'manufacturer:'+id,pack:pack(n),line:'Standard'}));
const oldBami={id:'frosta-bami',title:'FRoSTA Bami Goreng',brand:'FRoSTA',groupId:'frosta-meals',variantId:'frosta-bami',pack:pack(500)};
const generic={id:'frosta-any',title:'FRoSTA Fertiggerichte',brand:'FRoSTA',groupId:'frosta-meals',variantId:null,pack:{min:450,max:500,unit:'g'}};
const products=[...retailers,...manufacturers,oldBami,generic];
const offer=(p,extra={})=>({id:'price:'+p.id,productId:p.id,title:p.title,pack:p.pack,groupIds:[p.groupId,'frosta-ready-meals'],
 variantIds:[p.variantId],priceCents:479,priceKind:'regular',storeId:'aldi-test',start:'2026-10-20',end:'2026-10-20',
 verification:'source',sourceUrl:'https://www.aldi-sued.de/',...extra});

test('audited FRoSTA retailer names reach exact manufacturer and saved legacy variants',()=>{
 const raw=retailers.map(p=>offer(p)),before=JSON.stringify(raw);
 const annotated=C.annotateOffers(raw,products);
 manufacturers.forEach((p,i)=>{
  assert.equal(E.match(p,annotated[i]).status,'exact',p.title);
  for(let j=0;j<manufacturers.length;j++)if(i!==j)assert.equal(E.match(manufacturers[j],annotated[i]).status,'none');
  assert.equal(E.match(retailers[i],annotated[i]).status,'exact');
  assert.equal(annotated[i].priceCents,479);assert.equal(annotated[i].priceKind,'regular');
  assert.equal(annotated[i].start,'2026-10-20');assert.equal(annotated[i].end,'2026-10-20');
 });
 assert.equal(E.match(oldBami,annotated[0]).status,'exact');
 assert.equal(JSON.stringify(raw),before,'source data remains immutable');
 assert.deepEqual(C.annotateOffers(annotated,products),annotated,'annotation is idempotent');
 assert.equal(E.bestOffers(oldBami,annotated,{weekStart:'2026-10-19',notBefore:'2026-10-20'}).length,1);
});

test('general meals and opt-in same-line choices gain linked standard offers without crossing pack sizes',()=>{
 const annotated=C.annotateOffers(retailers.map(p=>offer(p)),products);
 assert.equal(annotated.filter(o=>E.match(generic,o).status==='group').length,5);
 const choice=C.getChoice(oldBami,products);
 assert.equal(choice.kind,'frosta');
 assert.equal(annotated.filter(o=>E.match(choice.product,o).status==='group').length,4);
 const large={...manufacturers[1],id:'large',title:'FRoSTA Butter Chicken 800 g',pack:pack(800),line:'XXL',groupId:'frosta-line:xxl'};
 assert.equal(annotated.filter(o=>E.match(large,o).status!=='none').length,0);
 const largeChoice=C.getChoice(large,[...products,large]);
 assert.equal(annotated.filter(o=>E.match(largeChoice.product,o).status!=='none').length,0);
});

test('generic, mixed, special-diet, different-brand and conflicting-pack text cannot acquire an exact FRoSTA identity',()=>{
 const target=manufacturers[1],source=retailers[1];
 const rejected=[
  {title:'FROSTA Fertiggerichte 500 g'},
  {title:'FROSTA Butter Chicken oder Bami Goreng 500 g'},
  {title:'FROSTA Veganes Butter Chicken 500 g'},
  {title:'FROSTA High Protein Butter Chicken 500 g'},
  {title:'FROSTA Butter Chicken 800 g'},
  {pack:pack(800)},
  {pack:{min:450,max:500,unit:'g'}},
  {packUnconfirmed:true},
  {brand:'Andere Marke'},
  {line:'Premium'},
  {vegan:true},
  {verification:'unverified'}
 ];
 for(const extra of rejected){
  const [annotated]=C.annotateOffers([offer(source,extra)],products);
  assert.notEqual(E.match(target,annotated).status,'exact',JSON.stringify(extra));
  assert.ok(!annotated.variantIds?.includes(target.variantId),JSON.stringify(extra));
 }
});

test('the authoritative offer text defeats a linked catalogue name and 800 g is never reinterpreted as 500 g',()=>{
 const [other]=C.annotateOffers([offer(retailers[1],{title:'FROSTA Kräuter 500 g'})],products);
 assert.equal(E.match(manufacturers[1],other).status,'none');
 const stale={...manufacturers[1],title:'FRoSTA Butter Chicken 800 g',pack:pack(500)};
 const [annotated]=C.annotateOffers([offer(retailers[1])],[...retailers,stale]);
 assert.equal(E.match(stale,annotated).status,'none');
 const noKaufland=C.annotateOffers(retailers.map(p=>offer(p)),products);
 assert.equal(noKaufland.filter(o=>o.storeId==='kaufland-test').length,0);
});
