'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const E=require('../site/engine.js'),Shopping=require('../site/shopping.js');
const pack={min:500,max:500,unit:'g'};
function openOffers({products=[],offers=[],shoppingLayouts={}}={}){
  const data={catalog:{stores:[{id:'a',name:'Markt A',retailerId:'aldi'},{id:'b',name:'Markt B',retailerId:'kaufland'},{id:'off',name:'Nicht ausgewählt',retailerId:'rewe'}],products,offers,observedAt:'2026-10-19'},assortment:{products:[],sources:{}},status:{stores:{}},leaflets:{leaflets:[]}};
  const model={base:{items:[],offers:[],settings:{maxStores:2,enabledStores:['a','b'],knownStoreIds:['a','b','off'],shoppingLayouts}},photos:false};
  const storage=new Map([['sparnah-v1',JSON.stringify(model)]]),elements=new Map(),handlers={};
  let refreshData;
  function el(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},removeAttribute(){},focus(){}});return elements.get(id);}
  const document={getElementById:el,addEventListener:(name,fn)=>handlers[name]=fn,visibilityState:'visible'};
  const window={document,addEventListener(){},setInterval(){},scrollTo(){},SparnahVault:{getData:()=>data,getStatus:()=>({}),subscribe(fn){refreshData=fn;}}};
  for(const [key,file] of Object.entries({SparnahShopping:'shopping',SparnahLogos:'logos',SparnahEstimates:'estimates',SparnahStores:'stores',SparnahEngine:'engine',SparnahSearch:'search',SparnahChoices:'choices',SparnahSelection:'selection',SparnahUpdates:'updates',SparnahLeaflets:'leaflets'}))window[key]=require('../site/'+file+'.js');
  window.SparnahEngine={...E,berlinToday:()=> '2026-10-19',mondayOf:()=> '2026-10-19',nextMonday:()=> '2026-10-26'};
  vm.runInNewContext(fs.readFileSync(require.resolve('../site/app.js'),'utf8'),{window,document,location:{protocol:'https:'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},crypto:webcrypto,Intl,URL,console,setInterval(){},setTimeout(){},clearTimeout(){},navigator:{}});
  const click=(action,extra={})=>handlers.click({preventDefault(){},target:{closest:()=>({dataset:{action,...extra}})}});
  click('tab',{tab:'offers'});
  return {
    html:()=>el('main').innerHTML,
    input:value=>{handlers.input({target:{id:'offer-search',value}});return el('offer-results').innerHTML;},
    changeStore:value=>handlers.change({target:{id:'offer-store',value,classList:{contains:()=>false}}}),
    changeWeek:value=>click('week',{week:value}),
    subscribe:(store,checked)=>handlers.change({target:{id:'',checked,dataset:{store},classList:{contains:name=>name==='store-toggle'}}}),
    element:el,
    refresh:next=>{data.catalog.offers=next;refreshData(data);},
    data
  };
}
const offer=(id,title,extra={})=>({id,productId:id,title,pack,groupIds:[id],priceCents:199,storeId:'a',start:'2026-10-19',end:'2026-10-24',verification:'source',sourceUrl:'https://example.com/'+id,...extra});
const categoryIds=html=>[...html.matchAll(/<h2 id="offer-category-([^"]+)"/g)].map(m=>m[1]);
const titles=html=>[...html.matchAll(/<article class="offer-card">.*?<h3>(.*?)<\/h3>/gs)].map(m=>m[1]);
const storeOptions=app=>app.html().match(/<select id="offer-store"[^>]*>(.*?)<\/select>/s)[1];
const storeIds=app=>[...storeOptions(app).matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]);

test('changing offers are grouped once each from category or title, with an unknown fallback',()=>{
  const offers=[
    offer('milk','Vollmilch'),offer('unknown','Saisonüberraschung'),offer('apple','Äpfel'),
    offer('cleaner','Apfel Shampoo'),offer('frozen','TK Brokkoli'),offer('bread','Vollkornbrot'),
    offer('other-apple','Äpfel',{storeId:'b',priceCents:249})
  ];
  const app=openOffers({offers,products:[{id:'cleaner',title:'Apfel Shampoo',category:'Drogerie'}]});
  assert.deepEqual(categoryIds(app.html()),['produce','bakery','household','dairy','frozen','other']);
  assert.deepEqual(titles(app.html()),['Äpfel','Äpfel','Vollkornbrot','Apfel Shampoo','Vollmilch','TK Brokkoli','Saisonüberraschung']);
  assert.match(app.html(),/id="offer-category-produce">Obst &amp; Gemüse <span class="count-badge">2<\/span>/);
  assert.match(app.html(),/7 Angebote erfasst/);
  assert.match(app.html(),/2,49/);
  app.refresh([offer('new-rice','Basmati Reis'),offer('new-water','Mineralwasser')]);
  assert.deepEqual(categoryIds(app.html()),['pantry','drinks']);
  assert.deepEqual(titles(app.html()),['Basmati Reis','Mineralwasser']);
});

test('live search and market filter retain grouping, counts and clear empty categories',()=>{
  const app=openOffers({offers:[offer('apple','Äpfel'),offer('milk','Vollmilch'),offer('water','Mineralwasser',{storeId:'b'})]});
  let html=app.input('milch');
  assert.deepEqual(categoryIds(html),['dairy']);assert.deepEqual(titles(html),['Vollmilch']);
  assert.equal(app.element('offer-count').textContent,'1 Angebote erfasst');
  html=app.input('keintreffer');
  assert.equal(html,'');assert.equal(app.element('offer-empty').hidden,false);
  assert.equal(app.element('offer-count').textContent,'0 Angebote erfasst');
  app.input('');app.changeStore('b');
  assert.deepEqual(categoryIds(app.html()),['drinks']);assert.deepEqual(titles(app.html()),['Mineralwasser']);
});

test('grouping preserves subscription, week, confirmed-price and no-card restrictions',()=>{
  const offers=[
    offer('yes','Milch'),offer('off','Äpfel',{storeId:'off'}),
    offer('expired','Brot',{start:'2026-10-12',end:'2026-10-17'}),
    offer('future','Gouda',{start:'2026-10-26',end:'2026-10-31'}),
    offer('regular','Mineralwasser',{priceKind:'regular'}),
    offer('card','Salami',{requiresCard:true}),offer('app','Butter',{requiresApp:true}),
    offer('unconfirmed','Reis',{verification:'unverified'}),offer('unknown-price','Nudeln',{priceCents:null})
  ];
  const before=JSON.stringify(offers),app=openOffers({offers});
  assert.deepEqual(categoryIds(app.html()),['dairy']);assert.deepEqual(titles(app.html()),['Milch']);
  assert.equal(JSON.stringify(offers),before);
});

test('personal market order, labels and product assignments do not alter offer categories',()=>{
  let custom=Shopping.layout('aldi');
  custom=Shopping.moveArea(custom,'dairy',-99);
  custom=Shopping.updateArea(custom,'dairy',{label:'Mein erster Gang'});
  custom=Shopping.assign(custom,'apple','dairy');
  const offers=[offer('milk','Milch'),offer('apple','Äpfel')],products=[{id:'apple',title:'Äpfel',category:'Obst'}];
  const baseline=openOffers({offers,products}),edited=openOffers({offers,products,shoppingLayouts:{aldi:custom,kaufland:custom}});
  assert.deepEqual(categoryIds(edited.html()),categoryIds(baseline.html()));
  assert.deepEqual(titles(edited.html()),titles(baseline.html()));
  assert.doesNotMatch(edited.html(),/Mein erster Gang/);
  assert.deepEqual(categoryIds(edited.html()),['produce','dairy']);
});

test('offer selector only lists subscribed markets with usable offers in the chosen week',()=>{
  const app=openOffers({offers:[offer('a','Milch'),offer('off','Brot',{storeId:'off'})]});
  assert.deepEqual(storeIds(app),['all','a']); // Subscribed market B has no offers.
  app.subscribe('off',true);
  assert.deepEqual(storeIds(app),['all','a','off']);
  app.changeStore('off');app.subscribe('off',false);
  assert.deepEqual(storeIds(app),['all','a']);
  assert.match(storeOptions(app),/value="all" selected/);
  for(const invalid of [
    {priceKind:'regular'},{verification:'unverified'},{priceCents:null},{requiresCard:true},{requiresApp:true},
    {start:'2026-10-12',end:'2026-10-17'},{start:'2026-10-26',end:'2026-10-31'}
  ]){
    app.refresh([offer('a','Milch'),offer('b','Gouda',{storeId:'b',...invalid})]);
    assert.deepEqual(storeIds(app),['all','a'],JSON.stringify(invalid));
  }
});

test('search text does not remove markets or reset a selected market, even after rerender',()=>{
  const app=openOffers({offers:[offer('a','Milch'),offer('b','Brot',{storeId:'b'})]});
  app.changeStore('b');
  assert.deepEqual(titles(app.input('milch')),[]);
  app.changeStore('b'); // Rerender with the search still active.
  assert.deepEqual(storeIds(app),['all','a','b']);
  assert.match(storeOptions(app),/value="b" selected/);
  assert.deepEqual(titles(app.html()),[]);
  assert.deepEqual(titles(app.input('')),['Brot']);
});

test('week change and catalog refresh reset unavailable market filters without losing offers',()=>{
  const next=offer('b','Gouda',{storeId:'b',start:'2026-10-26',end:'2026-10-31'});
  const app=openOffers({offers:[offer('a','Milch'),next]});
  app.changeStore('a');app.changeWeek('next');
  assert.deepEqual(storeIds(app),['all','b']);
  assert.match(storeOptions(app),/value="all" selected/);
  assert.deepEqual(titles(app.html()),['Gouda']);
  app.changeStore('b');
  app.refresh([offer('a-next','Äpfel',{start:'2026-10-26',end:'2026-10-31'})]);
  assert.deepEqual(storeIds(app),['all','a']);
  assert.match(storeOptions(app),/value="all" selected/);
  assert.deepEqual(titles(app.html()),['Äpfel']);
  app.refresh([]);
  assert.deepEqual(storeIds(app),['all']);
  assert.match(storeOptions(app),/Keine Angebote erfasst/);
  assert.match(app.html(),/Hier fehlen noch Angebotsdaten/);
  assert.doesNotMatch(app.html(),/Noch keine Märkte gewählt/);
});
