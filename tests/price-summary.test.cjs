'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const E=require('../site/engine.js');
function openApp({referencePriceCents=null,originalPrice=399}={}){
 const product={id:'original',groupId:'original',variantId:'original450',title:'Nutella',brand:'Ferrero',pack:{min:450,max:450,unit:'g'}};
 const alternative={id:'own',groupId:'own',variantId:'own400',title:'House Nuss-Nougat-Creme',brand:'House',pack:{min:400,max:400,unit:'g'}};
 const missing={id:'missing',title:'Unpriced food',groupId:'missing'};
 const price=(p,cents)=>({id:p.id,productId:p.id,title:p.title,brand:p.brand,groupIds:[p.groupId],variantIds:[p.variantId],pack:p.pack,priceCents:cents,priceKind:'regular',storeId:'shop',start:'2026-10-19',end:'2026-10-19',verification:'source',sourceUrl:'https://example.com/price/'+p.id});
 const data={catalog:{stores:[{id:'shop',name:'Example shop'},{id:'other',name:'Other shop'}],products:[product,alternative,missing],offers:[...(originalPrice!==null?[price(product,originalPrice)]:[]),{...price(alternative,199),referencePriceCents}],observedAt:'2026-10-19'},assortment:{products:[],sources:{}},status:{stores:{}},leaflets:{leaflets:[]}};
 const model={base:{items:[product,missing].map(p=>({id:p.id,product:p,qty:1})),offers:[],settings:{maxStores:1,enabledStores:['shop'],knownStoreIds:['shop','other']}},photos:false};
 const storage=new Map([['sparnah-v1',JSON.stringify(model)]]),elements=new Map(),handlers={};
 function el(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},removeAttribute(){},focus(){}});return elements.get(id);}
 const doc={getElementById:el,addEventListener:(name,fn)=>handlers[name]=fn,visibilityState:'visible'};
 const window={document:doc,addEventListener(){},setInterval(){},scrollTo(){},SparnahVault:{getData:()=>data,getStatus:()=>({}),subscribe(){}}};
 for(const [key,file] of Object.entries({SparnahStores:'stores',SparnahEngine:'engine',SparnahSearch:'search',SparnahChoices:'choices',SparnahSelection:'selection',SparnahUpdates:'updates',SparnahLeaflets:'leaflets'}))window[key]=require('../site/'+file+'.js');
 window.SparnahEngine={...E,berlinToday:()=> '2026-10-19'};
 vm.runInNewContext(fs.readFileSync(require.resolve('../site/app.js'),'utf8'),{window,document:doc,location:{protocol:'https:'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},crypto:webcrypto,Intl,URL,console,setInterval(){},setTimeout(){},clearTimeout(){},navigator:{}});
 return {html:()=>el('main').innerHTML,storage,product,change:target=>handlers.change({target:{classList:{contains:()=>false},...target}}),click:async(action,extra={})=>handlers.click({preventDefault(){},target:{closest:()=>({dataset:{action,...extra}})}})};
}
test('normal-price partial plan explains missing prices without the misleading discount failure',async()=>{
 const app=openApp();await app.click('tab',{tab:'plan'});
 assert.match(app.html(),/Bekannte Zwischensumme/);assert.match(app.html(),/1 Preis noch offen/);
 assert.match(app.html(),/1 Preis berücksichtigt/);assert.match(app.html(),/Kein Händler-Rabatt mit höherem Vergleichspreis erfasst/);
 assert.doesNotMatch(app.html(),/Nicht belegbar|Belegte Rabatte/);
});
test('button shows real per-kilo comparison in list and plan and exact choice is reversible',async()=>{
 const app=openApp();await app.click('all-cheapest');
 for(const tab of ['list','plan']){
  await app.click('tab',{tab});assert.match(app.html(),/4,98.*statt 8,87/);assert.match(app.html(),/43,9 % günstiger/);assert.match(app.html(),/400 g statt 450 g/);
 }
 assert.match(app.html(),/1 günstigere Alternative/);
 await app.click('item-choice',{id:'original',mode:'exact'});assert.doesNotMatch(app.html(),/43,9 % günstiger/);
 const saved=JSON.parse(app.storage.get('sparnah-v1'));assert.deepEqual(saved.base.items[0].product,app.product);assert.deepEqual(saved.base.settings.enabledStores,['shop']);
});
test('no original price means no invented saving; real merchant discounts remain separate',async()=>{
 const missing=openApp({originalPrice:null});await missing.click('all-cheapest');await missing.click('tab',{tab:'plan'});
 assert.doesNotMatch(missing.html(),/% günstiger|1 günstigere Alternative/);assert.match(missing.html(),/1 Preis berücksichtigt/);
 const discount=openApp({referencePriceCents:249});await discount.click('all-cheapest');await discount.click('tab',{tab:'plan'});
 assert.match(discount.html(),/Händler-Rabatte: 0,50/);assert.match(discount.html(),/Nicht zur Ersparnis durch Produktwechsel addieren/);
});
test('shop pages, plan and settings do not expose addresses or map actions',async()=>{
 const app=openApp();
 for(const tab of ['list','stores','settings','plan','offers']){
  await app.click('tab',{tab});assert.doesNotMatch(app.html(),/google\.com\/maps|Google Maps|Weg zum Laden|Filialadresse/);
 }
});

test('offers shop selector follows subscriptions and clears a removed shop filter',async()=>{
 const app=openApp();
 const options=()=>app.html().match(/<select id="offer-store"[^>]*>(.*?)<\/select>/s)[1];
 await app.click('tab',{tab:'offers'});
 assert.match(options(),/value="shop"/);assert.doesNotMatch(options(),/value="other"/);
 app.change({id:'',classList:{contains:()=>true},checked:true,dataset:{store:'other'}});
 assert.match(options(),/value="other"/);
 app.change({id:'offer-store',value:'other'});
 assert.match(options(),/value="other" selected/);
 app.change({id:'',classList:{contains:()=>true},checked:false,dataset:{store:'other'}});
 assert.doesNotMatch(options(),/value="other"/);
 // Re-enabling the shop must not resurrect the removed filter.
 app.change({id:'',classList:{contains:()=>true},checked:true,dataset:{store:'other'}});
 assert.doesNotMatch(options(),/value="other" selected/);
 await app.click('clear-stores');
 assert.equal((options().match(/<option/g)||[]).length,1);
 assert.match(app.html(),/Noch keine Märkte gewählt/);
});
