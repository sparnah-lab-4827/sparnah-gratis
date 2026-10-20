'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const E=require('../site/engine.js');
function openApp({referencePriceCents=null,originalPrice=399,today="2026-10-19",missingProduct=null,savedModel=null}={}){
 const product={id:'original',groupId:'original',variantId:'original450',title:'Nutella',brand:'Ferrero',pack:{min:450,max:450,unit:'g'}};
 const alternative={id:'own',groupId:'own',variantId:'own400',title:'House Nuss-Nougat-Creme',brand:'House',pack:{min:400,max:400,unit:'g'}};
 const missing=missingProduct||{id:'missing',title:'Unpriced food',groupId:'missing'};
 const price=(p,cents)=>({id:p.id,productId:p.id,title:p.title,brand:p.brand,groupIds:[p.groupId],variantIds:[p.variantId],pack:p.pack,priceCents:cents,priceKind:'regular',storeId:'shop',start:today,end:today,verification:'source',sourceUrl:'https://example.com/price/'+p.id});
 const data={catalog:{stores:[{id:'shop',name:'Example shop',retailerId:'rewe'},{id:'other',name:'Other shop',retailerId:'kaufland'}],products:[product,alternative,missing],offers:[...(originalPrice!==null?[price(product,originalPrice)]:[]),{...price(alternative,199),referencePriceCents}],observedAt:'2026-10-19'},assortment:{products:[],sources:{}},status:{stores:{}},leaflets:{leaflets:[]}};
 const model={base:{items:[product,missing].map(p=>({id:p.id,product:p,qty:1})),offers:[],settings:{maxStores:1,enabledStores:['shop'],knownStoreIds:['shop','other']}},photos:false};
 let shared='',planCalls=0,refreshData;
 const storage=new Map([['sparnah-v1',savedModel||JSON.stringify(model)]]),elements=new Map(),handlers={};
 function el(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},removeAttribute(){},focus(){}});return elements.get(id);}
 const doc={getElementById:el,addEventListener:(name,fn)=>handlers[name]=fn,visibilityState:'visible'};
 const window={document:doc,addEventListener(){},setInterval(){},scrollTo(){},SparnahVault:{getData:()=>data,getStatus:()=>({}),subscribe(fn){refreshData=fn;}}};
 for(const [key,file] of Object.entries({SparnahShopping:'shopping',SparnahLogos:'logos',SparnahEstimates:'estimates',SparnahStores:'stores',SparnahEngine:'engine',SparnahSearch:'search',SparnahChoices:'choices',SparnahSelection:'selection',SparnahUpdates:'updates',SparnahLeaflets:'leaflets'}))window[key]=require('../site/'+file+'.js');
 window.SparnahEngine={...E,berlinToday:()=>today,optimize(...args){planCalls++;return E.optimize(...args);}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../site/app.js'),'utf8'),{window,document:doc,location:{protocol:'https:'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},crypto:webcrypto,Intl,URL,console,setInterval(){},setTimeout(){},clearTimeout(){},navigator:{share:async data=>{shared=data.text;}}});
 return {planCalls:()=>planCalls,advanceDay:()=>{today=E.addDays(today,1);},refresh:()=>refreshData(data),shared:()=>shared,html:()=>el('main').innerHTML,elementHtml:id=>el(id).innerHTML,storage,product,setValue:(id,value)=>el(id).value=value,submit:id=>handlers.submit({preventDefault(){},target:{id}}),input:target=>handlers.input({target}),change:target=>handlers.change({target:{classList:{contains:()=>false},...target}}),click:async(action,extra={})=>handlers.click({preventDefault(){},target:{closest:()=>({dataset:{action,...extra}})}})};
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

test('missing prices show distinct estimates without changing confirmed totals, savings or offer results',async()=>{
 const app=openApp({today:'2026-10-20',missingProduct:{id:'missing',title:'Butter'}});
 assert.match(app.html(),/Geschätzt: ca. 1,20/);
 await app.click('tab',{tab:'plan'});
 assert.match(app.html(),/Geschätztes Einkaufsbudget/);assert.match(app.html(),/ca. 5,19/);
 assert.match(app.html(),/3,99.*belegte Preise/);assert.match(app.html(),/1 Preis noch offen/);
 assert.doesNotMatch(app.html(),/1 günstigere Alternative/);
 await app.click('share-plan');assert.match(app.shared(),/Geschätzt ca. 1,20/);assert.match(app.shared(),/ca. 5,19/);
 await app.click('tab',{tab:'offers'});assert.doesNotMatch(app.html(),/Geschätzt|Richtwert/);
 await app.click('tab',{tab:'settings'});assert.match(app.html(),/Richtpreisliste/);assert.match(app.html(),/20.04./);
 await app.click('clear-stores');await app.click('tab',{tab:'list'});assert.doesNotMatch(app.html(),/Geschätzt: ca./);
});

test('Soba without a merchant price gets a labelled pack estimate in list, plan and export',async()=>{
 const app=openApp({today:'2026-10-20',missingProduct:{id:'soba-group-bag',title:'Nissin Soba Bag / Beutel',brand:'Nissin',category:'Fertiggerichte',isGroupChoice:true,pack:null}});
 assert.match(app.html(),/Geschätzt: ca. 1,10/);
 assert.match(app.html(),/Angenommene Packung:/);
 assert.match(app.html(),/ähnlichen Produkt geschätzt/);
 await app.click('quantity',{id:'soba-group-bag',delta:'1'});
 assert.match(app.html(),/Geschätzt: ca. 2,20/);
 await app.click('tab',{tab:'plan'});
 assert.match(app.html(),/ca. 6,19/);assert.match(app.html(),/3,99.*belegte Preise/);
 await app.click('share-plan');
 assert.match(app.shared(),/Geschätzt ca. 2,20/);assert.match(app.shared(),/angenommene Packung/);
 assert.match(app.shared(),/ähnliches Produkt/);
 await app.click('tab',{tab:'offers'});assert.doesNotMatch(app.html(),/Geschätzt/);
 assert.deepEqual(JSON.parse(app.storage.get('sparnah-v1')).base.settings.enabledStores,['shop']);
});

test('cached plan is reused across views and invalidated by quantity, selection, day and catalog updates',async()=>{
 const app=openApp();const initial=app.planCalls();
 await app.click('tab',{tab:'plan'});await app.click('tab',{tab:'list'});
 assert.equal(app.planCalls(),initial);
 await app.click('quantity',{id:'original',delta:'1'});assert.equal(app.planCalls(),initial+1);
 await app.click('all-cheapest');assert.equal(app.planCalls(),initial+2);
 app.change({id:'',classList:{contains:()=>true},checked:true,dataset:{store:'other'}});
 assert.equal(app.planCalls(),initial+3);
 app.advanceDay();await app.click('tab',{tab:'plan'});assert.equal(app.planCalls(),initial+4);
 app.refresh();assert.equal(app.planCalls(),initial+5);
});

test('mobile navigation keeps the plan directly accessible and moves setup behind the gear',async()=>{
 const app=openApp();
 const nav=()=>app.elementHtml('bottom-nav');
 assert.equal((nav().match(/class="nav-item/g)||[]).length,5);
 assert.match(nav(),/data-tab="plan"/);assert.doesNotMatch(nav(),/data-tab="stores"|data-tab="settings"/);
 assert.match(app.elementHtml('header'),/aria-label="Einstellungen und Händlerauswahl"/);
 await app.click('tab',{tab:'plan'});
 assert.match(nav(),/class="nav-item active" data-action="tab" data-tab="plan"/);
 assert.doesNotMatch(app.html(),/id="plan-destination"/);
 await app.click('tab',{tab:'settings'});
 assert.match(app.html(),/id="plan-destination"/);assert.match(app.html(),/id="split-days"/);
 assert.match(app.html(),/data-action="max-stores"/);assert.match(app.html(),/class="store-toggle"/);
 assert.match(app.html(),/data-tab="stores"/);
 await app.click('pick-store',{control:'plan-destination',value:'shop'});
 assert.equal(JSON.parse(app.storage.get('sparnah-v1')).base.settings.targetStoreId,'shop');
});
test('logo pickers in offers and brands follow selected stores and apply the chosen filter',async()=>{
 const app=openApp();
 for(const [tab,control] of [['offers','offer-store'],['brands','brand-store']]){
  await app.click('tab',{tab});
  assert.match(app.html(),/src="logos\/rewe.svg"/);assert.doesNotMatch(app.html(),/src="logos\/kaufland.png"/);
  assert.match(app.html(),/data-action="pick-store"/);
  await app.click('pick-store',{control,value:'shop'});
  assert.match(app.html(),new RegExp('id="'+control+'-button" aria-label="Geschäft auswählen: REWE"'));
  assert.match(app.html(),/data-value="shop" aria-pressed="true"/);
  await app.click('pick-store',{control,value:'all'});
  assert.match(app.html(),/data-value="all" aria-pressed="true"/);
 }
 for(const tab of ['stores','settings','plan','list']){
  await app.click('tab',{tab});assert.match(app.html(),/src="logos\/rewe.svg"/);
 }
});

test('shopping visit includes unpriced items and selected alternatives, and checking keeps its route stable',async()=>{
 const opts={today:'2026-10-20',missingProduct:{id:'missing',title:'Butter',category:'Milchprodukte'}};
 const app=openApp(opts);await app.click('all-cheapest');await app.click('tab',{tab:'plan'});
 const day=app.html().match(/data-action="start-shopping" data-store="shop" data-day="([^"]+)"/)[1];
 await app.click('start-shopping',{store:'shop',day});
 assert.match(app.html(),/Einkaufen bei REWE/);assert.match(app.html(),/House Nuss-Nougat-Creme/);
 assert.match(app.html(),/Geschätzt: ca. 1,20/);assert.match(app.html(),/0 von 2 im Wagen/);
 assert.match(app.html(),/Vollständige Einkaufsliste in Marktreihenfolge/);
 assert.doesNotMatch(app.html(),/<select|<details|data-action="edit-market"|data-action="jump-area"/);
 assert.equal((app.html().match(/data-shopping-item=/g)||[]).length,2);
 assert.match(app.elementHtml('bottom-nav'),/class="nav-item active" data-action="tab" data-tab="plan"/);
 const before=app.planCalls();await app.click('check',{id:'original'});
 assert.match(app.html(),/1 von 2 im Wagen/);assert.match(app.html(),/data-shopping-item="original"/);
 assert.match(app.html(),/Im Einkaufswagen/);assert.equal(app.planCalls(),before);
 await app.click('check',{id:'missing'});assert.match(app.html(),/Alles im Wagen/);
 const saved=app.storage.get('sparnah-v1'),reloaded=openApp({...opts,savedModel:saved});
 assert.match(reloaded.html(),/Einkauf fortsetzen/);await reloaded.click('tab',{tab:'shopping'});
 assert.match(reloaded.html(),/2 von 2 im Wagen/);assert.match(reloaded.html(),/House Nuss-Nougat-Creme/);
 await reloaded.click('finish-shopping');
 const final=JSON.parse(reloaded.storage.get('sparnah-v1'));
 assert.equal(final.shoppingSession,undefined);assert.ok(final.base.items.every(i=>i.checked));
 assert.deepEqual(final.base.items[0].product,app.product);assert.deepEqual(final.base.settings.enabledStores,['shop']);
});

test('editing market order and assigning products immediately changes shopping list order and survives reload',async()=>{
 const opts={today:'2026-10-20',missingProduct:{id:'missing',title:'Butter',category:'Milchprodukte'}};
 const app=openApp(opts);await app.click('tab',{tab:'plan'});
 const day=app.html().match(/data-action="start-shopping" data-store="shop" data-day="([^"]+)"/)[1];
 await app.click('start-shopping',{store:'shop',day});
 assert.ok(app.html().indexOf('data-shopping-item="original"')<app.html().indexOf('data-shopping-item="missing"'));
 await app.click('edit-market',{store:'shop'});
 app.setValue('market-new-label','Mein Kühlregal');app.submit('market-add-area');
 const saved=()=>JSON.parse(app.storage.get('sparnah-v1'));
 let custom=saved().base.settings.shoppingLayouts.rewe.areas.find(a=>a.label==='Mein Kühlregal');
 assert.ok(custom);await app.click('move-area',{area:custom.id,delta:'-99'});
 // Input must persist before blur, so tapping a move/finish button cannot lose a name.
 app.input({classList:{contains:c=>c==='market-area-label'},dataset:{area:custom.id},value:'Kühlregal vorne'});
 app.change({classList:{contains:c=>c==='market-area-color'},dataset:{area:custom.id},value:'#2dd4bf'});
 app.change({classList:{contains:c=>c==='market-product-area'},dataset:{item:'missing'},value:custom.id});
 await app.click('market-editor-done');
 assert.ok(app.html().indexOf('data-shopping-item="missing"')<app.html().indexOf('data-shopping-item="original"'));
 assert.match(app.html(),/Kühlregal vorne/);
 const reloaded=openApp({...opts,savedModel:app.storage.get('sparnah-v1')});await reloaded.click('tab',{tab:'shopping'});
 assert.ok(reloaded.html().indexOf('data-shopping-item="missing"')<reloaded.html().indexOf('data-shopping-item="original"'));
 const layout=JSON.parse(reloaded.storage.get('sparnah-v1')).base.settings.shoppingLayouts.rewe;
 assert.equal(layout.areas[0].id,custom.id);assert.equal(layout.areas[0].color,'#2dd4bf');
 assert.equal(layout.assignments.missing,custom.id);
 await reloaded.click('edit-market',{store:'shop'});await reloaded.click('delete-area',{area:custom.id});await reloaded.click('market-editor-done');
 assert.match(reloaded.html(),/data-shopping-item="missing"/);
 assert.match(reloaded.html(),/<h2>Sonstiges<\/h2>/);
});

test('shopping snapshot never presents an expired price as current and market layouts stay separate',async()=>{
 const app=openApp({today:'2026-10-20'});await app.click('tab',{tab:'plan'});
 const day=app.html().match(/data-action="start-shopping" data-store="shop" data-day="([^"]+)"/)[1];
 await app.click('start-shopping',{store:'shop',day});assert.match(app.html(),/class="shopping-price"/);
 app.advanceDay();await app.click('tab',{tab:'shopping'});
 assert.doesNotMatch(app.html(),/class="shopping-price"/);assert.match(app.html(),/Planpreis ist heute nicht bestätigt/);
 await app.click('edit-market',{store:'shop'});await app.click('move-area',{area:'dairy',delta:'-99'});
 await app.click('tab',{tab:'settings'});await app.click('edit-market',{store:'other'});await app.click('move-area',{area:'meat',delta:'-99'});
 const layouts=JSON.parse(app.storage.get('sparnah-v1')).base.settings.shoppingLayouts;
 assert.equal(layouts.rewe.areas[0].id,'dairy');assert.equal(layouts.kaufland.areas[0].id,'meat');
 assert.doesNotMatch(app.html(),/Google Maps|Filialadresse/);
});
