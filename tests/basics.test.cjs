'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Choices=require('../site/choices.js');
const Engine=require('../site/engine.js');
const Selection=require('../site/selection.js');
const pack=(n,unit='g')=>({min:n,max:n,unit});
const wish=(id,title,size)=>({id,title,groupId:id,variantId:null,brand:'',pack:size});
const apples=wish('aepfel','Äpfel',pack(1000));
const pasta=wish('nudeln','Nudeln',pack(500));
function offer(title,size,price=199,extra={}){
  return {id:title,productId:title,title,groupIds:['specific:'+title],variantIds:[title],pack:size,
    priceCents:price,verification:'source',requiresCard:false,requiresApp:false,storeId:'market',
    start:'2026-10-19',end:'2026-10-24',...extra};
}
const match=(want,have,products=[apples,pasta])=>Engine.match(want,Choices.annotateOffers([have],products)[0]).status;

test('a general apple wish uses confirmed fresh apples with the requested pack',()=>{
  for(const title of ['Rote Tafeläpfel','Ital. Tafeläpfel, rot','Bioland dtsch. Tafeläpfel','Äpfel Royal Gala','Frische Äpfel im 1-kg-Beutel']){
    assert.equal(match(apples,offer(title,pack(1000))),'group',title);
  }
  assert.equal(match(apples,offer('Äpfel',pack(1500))),'none');
  assert.equal(match(apples,offer('Äpfel',pack(1,'St.'))),'none');
});

test('apple matching excludes other fruit, prepared products and uncertain weights',()=>{
  for(const title of ['Granatapfel','Erdäpfel','Apfelmus','Apfel Saft','Getrocknete Äpfel','Apfelringe','Äpfel in Schokolade','Äpfel mit Zimt','Äpfel oder Birnen','Äpfel Obstsalat','Apfel-Mango Püree']){
    assert.equal(match(apples,offer(title,pack(1000))),'none',title);
  }
  assert.equal(match(apples,offer('Äpfel',pack(1000),199,{packUnconfirmed:true})),'none');
  assert.equal(match(apples,offer('Äpfel',{min:1000,max:1500,unit:'g'})),'none');
  assert.equal(match(apples,offer('Äpfel',pack(1000),199,{verification:'unverified'})),'none');
});

test('a general pasta wish uses plain branded pasta without merging prepared dishes',()=>{
  const branded={id:'pasta-a',title:'Brand A Bio Spaghetti',brand:'Brand A',groupId:'specific',variantId:'spaghetti',pack:pack(500)};
  const good=offer(branded.title,pack(500),117,{productId:branded.id});
  assert.equal(match(pasta,good,[apples,pasta,branded]),'group');
  for(const title of ['Spaghetti','Penne rigate','Fusilli','Farfalle','Rigatoni','Bio Pasta verschiedene Sorten'])assert.equal(match(pasta,offer(title,pack(500))),'group',title);
  for(const title of ['Spaghetti Bolognese','Sauce für Spaghetti','Pasta Salat','Gefüllte Pasta','Ravioli','Soba Nudeln','Instant Nudeln','Rote Linsen Pasta','Glutenfreie Pasta','Eiernudeln','Gemüse Spaghetti'])assert.equal(match(pasta,offer(title,pack(500))),'none',title);
  assert.equal(match(pasta,offer('Spaghetti',pack(550))),'none');
});

test('specific choices stay specific and source prices, dates and metadata stay unchanged',()=>{
  const exact={...apples,id:'cultivar',groupId:'cultivar',variantId:'royal-gala',title:'Äpfel Royal Gala'};
  const raw=offer('Rote Tafeläpfel',pack(1000)),before=JSON.stringify(raw);
  const annotated=Choices.annotateOffers([raw],[apples,pasta,exact])[0];
  assert.equal(Engine.match(exact,annotated).status,'none');
  assert.equal(JSON.stringify(raw),before);
  for(const field of ['priceCents','pack','start','end','verification','variantIds'])assert.deepEqual(annotated[field],raw[field]);
});

test('basic matching produces the payable shop and total, and expires normally',()=>{
  const raw=[offer('Rote Tafeläpfel',pack(1000),199),offer('Spaghetti',pack(500),117)];
  const annotated=Choices.annotateOffers(raw,[apples,pasta]);
  const items=[{id:'line-a',product:apples,qty:2},{id:'line-b',product:pasta,qty:1}];
  const options={weekStart:'2026-10-19',notBefore:'2026-10-19',maxStores:1,enabledStores:['market']};
  const result=Engine.optimize(items,annotated,[{id:'market',name:'Market'}],options);
  assert.equal(result.complete,true);assert.equal(result.total,515);assert.equal(result.visits.length,1);
  assert.equal(Engine.optimize(items,annotated,[{id:'market',name:'Market'}],{...options,weekStart:'2026-10-26',notBefore:'2026-10-26'}).coverage,0);
});

test('a missing selected photo uses the food symbol without inventing an image',()=>{
  const selected=Selection.chosenProduct({...apples,emoji:'🍎'},offer('Rote Tafeläpfel',pack(1000)),[
    {id:'Rote Tafeläpfel',title:'Rote Tafeläpfel',pack:pack(1000),emoji:'🛒'}
  ]);
  assert.equal(selected.title,'Rote Tafeläpfel');assert.equal(selected.product.emoji,'🍎');
  assert.equal(selected.imageConfirmed,false);assert.equal(selected.product.image,null);
});
