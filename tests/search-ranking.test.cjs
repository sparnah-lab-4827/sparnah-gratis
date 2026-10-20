'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../site/search.js');
const pack=(n,unit='g')=>({min:n,max:n,unit});
const wish=(id,title,extra={})=>({id,title,brand:'',variantId:null,groupId:id,pack:pack(250),...extra});
const item=(id,title,extra={})=>({id:'assortment:'+id,title,brand:'Brand A',variantId:id,groupId:id,assortmentStoreId:'a',...extra});

test('egg search excludes dairy department matches and keeps the general choice first',()=>{
  const dairy=Array.from({length:40},(_,i)=>item('yogurt'+i,'Joghurt Natur',{category:'Milchprodukte & Eier',keywords:'Joghurt Natur Milchprodukte & Eier'}));
  const eggs=wish('eggs','Eier',{subtitle:'Größe M · 10 Stück',pack:pack(10,'St.')});
  const index=S.build([...dairy,item('eggs','Brand A Bio Eier 10 Stück'),item('noodles','Eiernudeln'),eggs]);
  for(const query of ['ei','eier','EIER']){
    const result=S.search(index,query);
    assert.equal(result.items[0].id,'eggs');assert.equal(result.total,3);
    assert.ok(result.items.every(p=>!p.title.includes('Joghurt')));
  }
});

test('general butter and pasta lead their results before catalogue order or pagination',()=>{
  const butter=wish('butter','Butter',{subtitle:'Marke egal · 250 g',keywords:'Brand A'});
  const pasta=wish('pasta','Nudeln',{subtitle:'Sorte und Marke egal · 500 g',pack:pack(500)});
  const index=S.build([
    item('selection','Brand A Butter oder Streichzart',{groupSelection:true}),
    ...Array.from({length:40},(_,i)=>item('butter'+i,'Brand A Butter 250 g')),
    {id:'instant',title:'Instant Noodles',brand:'Brand B',isGroupChoice:true,keywords:'nudeln'},
    butter,pasta,item('pasta','Brand A Nudeln 500 g')]);
  assert.equal(S.search(index,'butter',{limit:1}).items[0],butter);
  assert.equal(S.search(index,'butter 250g',{limit:1}).items[0],butter);
  assert.equal(S.search(index,'nudeln',{limit:1}).items[0],pasta);
  assert.equal(S.search(index,'Brand A Butter',{limit:1}).items[0].id,'assortment:selection');
});

test('typing the start of a food ranks it ahead of an embedded syllable in another group',()=>{
  const eggs=wish('eggs','Eier');
  const index=S.build([{id:'protein',title:'Brand B High Protein',brand:'Brand B',isGroupChoice:true},wish('rice','Reis'),eggs]);
  assert.equal(S.search(index,'ei').items[0],eggs);
});

test('compound categories do not turn potato puree into rice or yogurt into milk',()=>{
  const index=S.build([
    item('potato','Kartoffelpüree',{category:'Nudeln, Reis & Hülsenfrüchte',keywords:'Kartoffelpüree Nudeln, Reis & Hülsenfrüchte'}),
    item('rice','Basmati Reis'),wish('rice','Reis'),
    item('yogurt','Naturjoghurt',{category:'Milchprodukte & Eier',keywords:'Naturjoghurt Milchprodukte & Eier'}),
    item('milk','Vollmilch 3,5 %'),wish('milk','Milch 3,5 %',{pack:pack(1000,'ml')})]);
  assert.deepEqual(S.search(index,'reis').items.map(p=>p.id),['rice','assortment:rice']);
  assert.deepEqual(S.search(index,'milch').items.map(p=>p.id),['milk','assortment:milk']);
});

test('real names, aliases and sizes remain searchable and filters remain explicit',()=>{
  const branded=item('branded','Brand A Butter 250 g',{category:'Kühlregal',aliases:['Süßrahmbutter'],pack:pack(250)});
  const general=wish('butter','Butter');
  const chicken=item('chicken','Hähnchen XXL',{pack:pack(1000)});
  const index=S.build([branded,general,chicken]);
  assert.equal(S.search(index,'Sussrahmbutter').items[0],branded);
  assert.equal(S.search(index,'Hahnchen 1.000g').items[0],chicken);
  assert.equal(S.search(index,'Hähnchen 800g').total,0);
  assert.deepEqual(S.search(index,'butter',{store:'a',category:'Kühlregal'}).items,[branded]);
  assert.deepEqual(S.search(index,'',{category:'Kühlregal'}).items,[branded]);
});

test('brand families remain first for a brand search without hiding an exact variety',()=>{
  const family={id:'brand-family',title:'Brand B Fertiggerichte',brand:'Brand B',isGroupChoice:true,groupSelection:true,subtitle:'Sorte egal'};
  const exact=item('curry','Brand B Curry 450 g',{brand:'Brand B'});
  const index=S.build([exact,family]);
  assert.equal(S.search(index,'Brand B').items[0],family);
  assert.deepEqual(S.search(index,'Brand B Curry').items,[exact]);
});

test('ranked pagination is stable and searching never mutates chosen products',()=>{
  const products=[...Array.from({length:80},(_,i)=>item('rice'+i,'Reis')),wish('rice','Reis')];
  const before=JSON.stringify(products),index=S.build(products);
  const first=S.search(index,'reis'),more=S.search(index,'reis',{limit:48});
  assert.equal(first.total,81);assert.equal(first.items[0].id,'rice');
  assert.deepEqual(more.items.slice(0,24),first.items);assert.equal(JSON.stringify(products),before);
});

test('an explicit weight ranks the exact group ahead of a broader range',()=>{
  const broad=wish('meal-range','Brand B Fertiggerichte 450–500 g',{brand:'Brand B',isGroupChoice:true,pack:{min:450,max:500,unit:'g'}});
  const exact=wish('meal-exact','Brand B Fertiggerichte 500 g',{brand:'Brand B',isGroupChoice:true,pack:pack(500)});
  const large=wish('meal-large','Brand B Fertiggerichte 800 g',{brand:'Brand B',isGroupChoice:true,pack:pack(800)});
  const index=S.build([broad,exact,large]);
  const result=S.search(index,'Brand B 500g');
  assert.equal(result.items[0],exact);
  assert.ok(!result.items.includes(large));
  assert.deepEqual(S.search(index,'Brand B 800g').items,[large]);
});

test('global generic juice wishes remain first with a catalogue source filter without claiming retailer stock',()=>{
  const apple=wish('apfelsaft','Apfelsaft',{subtitle:'Marke egal · 1.000 ml',category:'Getränke',pack:pack(1000,'ml')});
  const own=item('apple-a','Brand A Apfelsaft',{category:'Getränke',pack:pack(1000,'ml')});
  const other=item('apple-b','Brand B Apfelsaft',{brand:'Brand B',assortmentStoreId:'b',category:'Getränke',pack:pack(1000,'ml')});
  const index=S.build([own,other,apple]),before=JSON.stringify(apple);
  assert.deepEqual(S.search(index,'apfelsaft',{store:'a'}).items,[apple,own]);
  assert.deepEqual(S.search(index,'apfelsaft',{store:'b'}).items,[apple,other]);
  assert.deepEqual(S.search(index,'apfelsaft',{store:'no-catalogue'}).items,[apple]);
  assert.equal(S.search(index,'apfelsaft',{store:'a',limit:1}).items[0],apple);
  assert.equal(S.search(index,'apfelsaft',{store:'a',category:'Haushalt'}).total,0);
  assert.equal(apple.assortmentStoreId,undefined);assert.equal(apple.assortmentSourceUrl,undefined);
  assert.equal(JSON.stringify(apple),before);
});

test('source filters keep scoped wishes and branded or imported products restricted to their actual source',()=>{
  const scoped=wish('local-apple','Apfelsaft',{assortmentStoreId:'b',pack:pack(1000,'ml')});
  const branded=wish('brand-family-apple','Brand B Apfelsaft',{brand:'Brand B',isGroupChoice:true,pack:pack(1000,'ml')});
  const manufacturer={...wish('manufacturer:apple','Apfelsaft'),pack:pack(1000,'ml')};
  const imported={...wish('import:apple','Apfelsaft'),pack:pack(1000,'ml')};
  const exact={...wish('exact-apple','Apfelsaft'),variantId:'exact',pack:pack(1000,'ml')};
  const index=S.build([scoped,branded,manufacturer,imported,exact]);
  assert.equal(S.search(index,'apfelsaft',{store:'a'}).total,0);
  assert.deepEqual(S.search(index,'apfelsaft',{store:'b'}).items,[scoped]);
  assert.equal(S.search(index,'apfelsaft').total,5);
});

test('juice brand queries stay specific and explicit pack queries select the right generic wish',()=>{
  const liter=wish('apfelsaft-1000','Apfelsaft',{subtitle:'Marke egal · 1.000 ml',pack:pack(1000,'ml')});
  const large=wish('apfelsaft-1500','Apfelsaft',{subtitle:'Marke egal · 1.500 ml',pack:pack(1500,'ml')});
  const brand=item('apple','Vitagold Apfelsaft',{brand:'Vitagold',pack:pack(1000,'ml')});
  const other=item('other-apple','Sonnental Apfelsaft',{brand:'Sonnental',assortmentStoreId:'b',pack:pack(1000,'ml')});
  const index=S.build([brand,other,large,liter]);
  assert.deepEqual(S.search(index,'Vitagold Apfelsaft',{store:'a'}).items,[brand]);
  assert.equal(S.search(index,'Sonnental Apfelsaft',{store:'a'}).total,0);
  assert.deepEqual(S.search(index,'Apfelsaft 1.000ml',{store:'a'}).items,[liter,brand]);
  assert.deepEqual(S.search(index,'Apfelsaft 1500ml',{store:'a'}).items,[large]);
  assert.equal(S.search(index,'Apfelsaft 750ml',{store:'a'}).total,0);
});
