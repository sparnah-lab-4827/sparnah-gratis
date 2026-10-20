'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../site/estimates.js'),E=require('../site/engine.js');
const nutella={title:'Nutella',brand:'Ferrero',pack:{min:450,max:450,unit:'g'}};
test('researched guide calculates rough pack and quantity budgets, never offers',()=>{
 const e=G.estimate(nutella,2,'2026-10-20');
 assert.equal(e.cents,400);assert.equal(e.total,800);assert.equal(e.referenceCents,399);
 assert.equal(e.sourceUrl.includes('aldi-sued.de'),true);
 assert.equal(e.storeId,undefined);assert.equal(e.verification,undefined);assert.equal(e.priceCents,undefined);
 const large=G.estimate({...nutella,pack:{min:800,max:800,unit:'g'}},1);
 assert.equal(large.cents,710);assert.equal(large.scaled,true);
 const namedSize=G.estimate({title:'Nutella 800 g'});
 assert.equal(namedSize.cents,710);assert.equal(namedSize.assumedPack,false);
 assert.equal(E.offerUsable(e,1),false);
});
test('brand, flavour, special diet, unit and size ambiguity are not silently guessed',()=>{
 for(const p of [
  {...nutella,title:'Nutella Biscuits'}, {...nutella,brand:'Other'},
  {...nutella,title:'Nutella Vegan'}, {...nutella,vegan:true},
  {...nutella,pack:{min:450,max:800,unit:'g'}},
  {...nutella,pack:{min:450,max:450,unit:'ml'}},
  {...nutella,pack:{min:3000,max:3000,unit:'g'}},
  {title:'Spaghetti Bolognese'}, {title:'Glutenfreie Spaghetti'},
  {title:'Weizenmehl Type 1050'}, {title:'Unbekannt'}
 ])assert.equal(G.estimate(p),null,JSON.stringify(p));
 assert.equal(G.estimate({title:'CUCINA Spaghetti 500 g',pack:{min:500,max:500,unit:'g'}}).cents,70);
});
test('assumed packs and overdue review are explicit and future snapshots do not travel back in time',()=>{
 const e=G.estimate({title:'Butter'},1,'2027-04-20');
 assert.equal(e.assumedPack,true);assert.equal(e.pack.min,250);assert.equal(e.stale,true);
 assert.equal(G.estimate(nutella,1,'2026-10-19'),null);
 assert.equal(G.estimate(nutella,0),null);
});
test('partial estimate summary keeps unrecognized positions missing and leaves input unchanged',()=>{
 const unknown=[{item:{product:nutella,qty:2}},{item:{product:{title:'Unbekannt'},qty:1}}];
 const before=JSON.stringify(unknown),s=G.summarize(unknown,'2026-10-20');
 assert.equal(s.total,800);assert.equal(s.count,1);assert.equal(s.remaining,1);
 assert.equal(JSON.stringify(unknown),before);
 for(const row of G.entries){
  assert.ok(Number.isInteger(row.cents)&&row.cents>0);
  assert.ok(row.sourceUrl.startsWith('https://www.aldi-sued.de/'));
 }
});
