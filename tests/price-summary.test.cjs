'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const E=require('../site/engine.js');
function openApp({referencePriceCents=null,originalPrice=399,today="2026-10-19",missingProduct=null,savedModel=null,configureFixture=()=>{}}={}){
 const product={id:'original',groupId:'original',variantId:'original450',title:'Nutella',brand:'Ferrero',pack:{min:450,max:450,unit:'g'}};
 const alternative={id:'own',groupId:'own',variantId:'own400',title:'House Nuss-Nougat-Creme',brand:'House',pack:{min:400,max:400,unit:'g'}};
 const missing=missingProduct||{id:'missing',title:'Unpriced food',groupId:'missing'};
 const price=(p,cents)=>({id:p.id,productId:p.id,title:p.title,brand:p.brand,groupIds:[p.groupId],variantIds:[p.variantId],pack:p.pack,priceCents:cents,priceKind:'regular',storeId:'shop',start:today,end:today,verification:'source',sourceUrl:'https://example.com/price/'+p.id});
 const data={catalog:{stores:[{id:'shop',name:'Example shop',retailerId:'rewe'},{id:'other',name:'Other shop',retailerId:'kaufland'}],products:[product,alternative,missing],offers:[...(originalPrice!==null?[price(product,originalPrice)]:[]),{...price(alternative,199),referencePriceCents}],observedAt:'2026-10-19'},assortment:{products:[],sources:{}},status:{stores:{}},leaflets:{leaflets:[]}};
 const model={base:{items:[product,missing].map(p=>({id:p.id,product:p,qty:1})),offers:[],settings:{maxStores:1,enabledStores:['shop'],knownStoreIds:['shop','other']}},photos:false};
 configureFixture(data,model);
 let shared='',planCalls=0,refreshData;
 const storage=new Map([['sparnah-v1',savedModel||JSON.stringify(model)]]),elements=new Map(),handlers={};
 function el(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},removeAttribute(){},focus(){},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(id);}
 const doc={getElementById:el,addEventListener:(name,fn)=>handlers[name]=fn,visibilityState:'visible'};
 const window={document:doc,addEventListener(){},setInterval(){},scrollTo(){},SparnahVault:{getData:()=>data,getStatus:()=>({}),subscribe(fn){refreshData=fn;}}};
 for(const [key,file] of Object.entries({SparnahShopping:'shopping',SparnahLogos:'logos',SparnahEstimates:'estimates',SparnahStores:'stores',SparnahEngine:'engine',SparnahSearch:'search',SparnahChoices:'choices',SparnahSelection:'selection',SparnahUpdates:'updates',SparnahLeaflets:'leaflets'}))window[key]=require('../site/'+file+'.js');
 window.SparnahEngine={...E,berlinToday:()=>today,optimize(...args){planCalls++;return E.optimize(...args);}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../site/app.js'),'utf8'),{window,document:doc,location:{protocol:'https:'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},crypto:webcrypto,Intl,URL,console,setInterval(){},setTimeout(){},clearTimeout(){},navigator:{share:async data=>{shared=data.text;}}});
 return {planCalls:()=>planCalls,advanceDay:()=>{today=E.addDays(today,1);},refresh:()=>refreshData(data),shared:()=>shared,html:()=>el('main').innerHTML,elementHtml:id=>el(id).innerHTML,confirmImport:()=>el('confirm-import').onclick(),storage,product,setValue:(id,value)=>el(id).value=value,submit:id=>handlers.submit({preventDefault(){},target:{id}}),input:target=>handlers.input({target}),change:target=>handlers.change({target:{classList:{contains:()=>false},...target}}),click:async(action,extra={})=>handlers.click({preventDefault(){},target:{closest:()=>({dataset:{action,...extra}})}})};
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
 const app=openApp({configureFixture:data=>{
   const start=E.mondayOf(),end=E.addDays(start,5);
   data.catalog.offers=data.catalog.offers.map((o,i)=>({...o,priceKind:'offer',storeId:i?'other':'shop',start,end}));
 }});
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

test('an old shopping session reloads the exact Soba photo without changing the saved wish or pack',async()=>{
 const savedProduct={id:'manufacturer:nissin:soba-fixture',title:'Nissin Soba Bag Classic',brand:'Nissin',variantId:'soba-fixture',groupId:'soba-fixture',pack:{min:109,max:109,unit:'g'},image:null};
 const photo='https://example.com/nissin-original.png';
 const opts={today:'2026-10-20',missingProduct:structuredClone(savedProduct),configureFixture(data,model){
  model.photos=true;
  const current=data.catalog.products.find(p=>p.id===savedProduct.id);
  current.image=photo;current.imagePack={...savedProduct.pack};
  model.base.items.find(i=>i.id===savedProduct.id).product={...savedProduct};
 }};
 const app=openApp(opts);await app.click('tab',{tab:'plan'});
 const day=app.html().match(/data-action="start-shopping" data-store="shop" data-day="([^"]+)"/)[1];
 await app.click('start-shopping',{store:'shop',day});
 const row=app.html().match(/<article[^>]*data-shopping-item="manufacturer:nissin:soba-fixture"[\s\S]*?<\/article>/)[0];
 assert.match(row,/src="https:\/\/example.com\/nissin-original.png"/);
 assert.match(row,/109 g/);assert.doesNotMatch(row,/Beispielbild/);
 const saved=JSON.parse(app.storage.get('sparnah-v1'));
 assert.deepEqual(saved.base.items.find(i=>i.id===savedProduct.id).product,savedProduct);
 const changed=openApp({...opts,savedModel:JSON.stringify(saved),configureFixture(data,model){
  opts.configureFixture(data,model);data.catalog.products.find(p=>p.id===savedProduct.id).imagePack={min:90,max:90,unit:'g'};
 }});
 await changed.click('tab',{tab:'shopping'});assert.doesNotMatch(changed.html(),/nissin-original\.png/);
});

test('group photos stay labelled examples and disabled photos remain symbols',async()=>{
 const group={id:'soba-group-bag',title:'Nissin Soba Bag / Beutel',brand:'Nissin',groupId:'soba-group-bag',isGroupChoice:true,image:'https://example.com/group.png',imageKind:'group-representative'};
 for(const photos of [true,false]){
  const app=openApp({today:'2026-10-20',missingProduct:group,configureFixture(data,model){model.photos=photos;}});
  await app.click('tab',{tab:'plan'});
  const day=app.html().match(/data-action="start-shopping" data-store="shop" data-day="([^"]+)"/)[1];
  await app.click('start-shopping',{store:'shop',day});
  if(photos)assert.match(app.html(),/<small class="thumb-label">Beispielbild<\/small>/);
  else assert.doesNotMatch(app.html(),/group\.png|class="thumb-label"/);
 }
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
 const app=openApp({configureFixture:data=>{
   const start=E.mondayOf(),end=E.addDays(start,5);
   data.catalog.offers=data.catalog.offers.map(o=>({...o,priceKind:'offer',start,end}));
 }});
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
 assert.match(app.html(),/Geschätzt ca. 1,20/);assert.match(app.html(),/0 von 2 im Wagen/);
 assert.doesNotMatch(app.html(),/Datierter Richtwert|Angenommene Packung:|Grundlage und Prüfdatum/);
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
 const beforeFinish=reloaded.planCalls();await reloaded.click('finish-shopping');
 assert.equal(reloaded.planCalls(),beforeFinish+1);
 const final=JSON.parse(reloaded.storage.get('sparnah-v1'));
 assert.equal(final.shoppingSession,undefined);assert.ok(final.base.items.every(i=>i.deleted));
 assert.doesNotMatch(reloaded.html(),/class="list-row/);
 const afterFinish=openApp({...opts,savedModel:reloaded.storage.get('sparnah-v1')});
 assert.doesNotMatch(afterFinish.html(),/class="list-row|Einkauf fortsetzen/);
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

test('one compact overview combines confirmed prices and partial estimates without inventing a full budget',async()=>{
 const app=openApp({today:'2026-10-20',missingProduct:{id:'missing',title:'Butter'},configureFixture(data,model){
  const unknown={id:'unclassified',title:'Unclassified fixture object',groupId:'unclassified'};
  data.catalog.products.push(unknown);model.base.items.push({id:unknown.id,product:unknown,qty:1});
 }});
 await app.click('tab',{tab:'plan'});
 const html=app.html(),overview=html.slice(html.indexOf('class="plan-overview"'),html.indexOf('<article class="plan-visit"'));
 assert.equal((html.match(/class="plan-overview"/g)||[]).length,1);
 assert.match(overview,/Bekannte Zwischensumme/);assert.match(overview,/3,99/);
 assert.match(overview,/Geschätzte Teilsumme/);assert.match(overview,/ca. 5,19/);
 assert.match(overview,/1 Position(?:\(en\))?[^<]*ohne Richtwert/);
 assert.doesNotMatch(html,/<section class="estimated-budget"/);
 assert.doesNotMatch(overview,/Alle Positionen sind für das Budget berücksichtigt/);
});

test('an unpriced-only visit shows an open price, no zero budget, and start buttons above and below products',async()=>{
 const app=openApp({today:'2026-10-20',configureFixture(data,model){
  data.catalog.offers=[];
  model.base.items=model.base.items.filter(i=>i.id==='missing');
  model.base.settings.targetStoreId='shop';
 }});
 await app.click('tab',{tab:'plan'});
 const html=app.html(),overview=html.slice(html.indexOf('class="plan-overview"'),html.indexOf('<article class="plan-visit"'));
 assert.match(overview,/Preis offen/);
 assert.doesNotMatch(overview,/0,00|Geschätztes Einkaufsbudget[^]*?ca\./);
 const visit=html.match(/<article class="plan-visit">([\s\S]*?)<\/article>/)[1];
 const startTags=visit.match(/<button[^>]*data-action="start-shopping"[^>]*>/g)||[];
 assert.equal(startTags.length,2);
 assert.match(visit,/<div class="visit-start-top"><button[^>]*data-action="start-shopping"/);
 const day=startTags[0].match(/data-day="([^"]+)"/)[1];
 assert.ok(visit.indexOf('visit-start-top')<visit.indexOf('unpriced-line'));
 for(const tag of startTags){assert.match(tag,/data-store="shop"/);assert.ok(tag.includes('data-day="'+day+'"'));}
 await app.click('start-shopping',{store:'shop',day});
 assert.match(app.html(),/0 von 1 im Wagen/);assert.match(app.html(),/data-shopping-item="missing"/);
});

test('two visits each start their own shop and day from the matching top and bottom buttons',async()=>{
 const app=openApp({today:'2026-10-20',configureFixture(data,model){
  const p=data.catalog.products.find(p=>p.id==='missing');
  p.variantId='missing-exact';p.pack={min:500,max:500,unit:'g'};
  data.catalog.offers.push({id:'other-price',productId:p.id,title:p.title,groupIds:[p.groupId],
   variantIds:[p.variantId],pack:p.pack,priceCents:250,priceKind:'regular',storeId:'other',
   start:'2026-10-21',end:'2026-10-21',verification:'source',sourceUrl:'https://example.com/other'});
  model.base.settings={...model.base.settings,maxStores:2,allowSplitDays:true,enabledStores:['shop','other']};
 }});
 await app.click('tab',{tab:'plan'});
 const visits=[...app.html().matchAll(/<article class="plan-visit">([\s\S]*?)<\/article>/g)];
 assert.equal(visits.length,2);
 const targets=visits.map(([,visit])=>{
  const buttons=visit.match(/<button[^>]*data-action="start-shopping"[^>]*>/g)||[];
  assert.equal(buttons.length,2);assert.match(visit,/<div class="visit-start-top"><button[^>]*data-action="start-shopping"/);
  assert.ok(visit.indexOf('visit-start-top')<visit.indexOf('class="visit-line"'));
  const store=buttons[0].match(/data-store="([^"]+)"/)[1],day=buttons[0].match(/data-day="([^"]+)"/)[1];
  assert.ok(buttons[1].includes('data-store="'+store+'"'));assert.ok(buttons[1].includes('data-day="'+day+'"'));
  assert.match(visit.slice(0,visit.indexOf('class="visit-line"')),store==='shop'?/REWE/:/Kaufland/);
  return {store,day};
 });
 assert.deepEqual(targets,[{store:'shop',day:'2026-10-20'},{store:'other',day:'2026-10-21'}]);
 for(const target of targets){
  await app.click('start-shopping',target);
  const session=JSON.parse(app.storage.get('sparnah-v1')).shoppingSession;
  assert.equal(session.storeId,target.store);assert.equal(session.day,target.day);
  assert.deepEqual(session.entries.map(e=>e.itemId),[target.store==='shop'?'original':'missing']);
  assert.equal((app.html().match(/data-shopping-item=/g)||[]).length,1);
  await app.click('tab',{tab:'plan'});
 }
 // Finishing the second visit must leave the first shop's pending product intact.
 await app.click('start-shopping',targets[1]);await app.click('check',{id:'missing'});
 await app.click('finish-shopping');
 const finished=JSON.parse(app.storage.get('sparnah-v1'));
 assert.equal(finished.base.items.find(i=>i.id==='missing').deleted,true);
 assert.equal(!!finished.base.items.find(i=>i.id==='original').deleted,false);
 assert.match(app.html(),/data-item="original"/);assert.doesNotMatch(app.html(),/data-item="missing"/);
 assert.deepEqual(finished.base.settings.enabledStores,['shop','other']);
});

test('ending an incomplete trip removes only its checked positions and preserves unrelated checked items and settings',async()=>{
 const app=openApp({today:'2026-10-20',configureFixture(data,model){
  const outside={id:'outside',title:'Already checked elsewhere',groupId:'outside'};
  const later={id:'later',title:'Added after this trip began',groupId:'later'};
  data.catalog.products.push(outside,later);
  model.base.items.push({id:outside.id,product:outside,qty:1,checked:true});
  model.base.settings.shoppingLayouts={rewe:{areas:[{id:'other',label:'Mein Bereich',icon:'🛒',color:'#a3a3a3'}],assignments:{original:'other'}}};
 }});
 const settings=JSON.parse(app.storage.get('sparnah-v1')).base.settings;
 await app.click('tab',{tab:'plan'});
 const day=app.html().match(/data-action="start-shopping" data-store="shop" data-day="([^"]+)"/)[1];
 await app.click('start-shopping',{store:'shop',day});
 await app.click('add-product',{id:'later'});
 await app.click('check',{id:'later'}); // This new checked item was never part of the session.
 await app.click('check',{id:'original'});
 await app.click('tab',{tab:'shopping'});
 assert.match(app.html(),/1 von 2 im Wagen/);assert.match(app.html(),/Rundgang beenden/);
 await app.click('finish-shopping');
 const saved=JSON.parse(app.storage.get('sparnah-v1'));
 assert.equal(saved.shoppingSession,undefined);
 assert.equal(saved.base.items.find(i=>i.id==='original').deleted,true);
 for(const id of ['missing','outside','later'])assert.equal(!!saved.base.items.find(i=>i.id===id).deleted,false,id);
 assert.deepEqual(saved.base.settings,settings);
 assert.match(app.html(),/data-item="missing"/);assert.match(app.html(),/data-item="outside"/);assert.match(app.html(),/data-item="later"/);
 assert.doesNotMatch(app.html(),/data-item="original"/);
 // No active session cannot erase products checked elsewhere.
 await app.click('finish-shopping');
 assert.deepEqual(JSON.parse(app.storage.get('sparnah-v1')).base.items,saved.base.items);
});

test('shopping rows retain a symbol with photos off and show verified photos only when enabled',async()=>{
 const app=openApp({today:'2026-10-20',configureFixture(data){
  const p=data.catalog.products.find(p=>p.id==='original');
  p.image='https://example.com/nutella.jpg';p.imageSourceUrl='https://example.com/nutella';
  p.imageAlt=p.title;p.emoji='🍫';
 }});
 await app.click('tab',{tab:'plan'});
 const day=app.html().match(/data-action="start-shopping" data-store="shop" data-day="([^"]+)"/)[1];
 await app.click('start-shopping',{store:'shop',day});
 assert.match(app.html(),/class="thumb /);assert.match(app.html(),/class="emoji"[^>]*>🍫/);
 assert.doesNotMatch(app.html(),/<img[^>]*src="https:\/\/example.com\/nutella.jpg"/);
 app.change({id:'photos',checked:true});
 assert.match(app.html(),/<img[^>]*src="https:\/\/example.com\/nutella.jpg"/);
 assert.doesNotMatch(app.html(),/<select|<details|data-action="edit-market"/);
});

test('a generated brand-free juice wish can be searched, planned, shopped and restored',async()=>{
 const options={today:'2026-10-20',configureFixture(data,model){
  model.base.items=[];
  const juice={id:'juice-brand',groupId:'juice-brand',variantId:'juice-brand-1l',title:'House Apfelsaft klar',brand:'House',pack:{min:1000,max:1000,unit:'ml'}};
  data.catalog.products.push(juice);
  data.catalog.offers.push({id:'juice-price',productId:juice.id,title:juice.title,brand:juice.brand,groupIds:[juice.groupId],variantIds:[juice.variantId],pack:juice.pack,priceCents:149,storeId:'shop',start:'2026-10-20',end:'2026-10-24',verification:'source',sourceUrl:'https://example.com/juice'});
 }};
 const app=openApp(options);
 app.input({id:'search',value:'Apfelsaft'});
 assert.match(app.elementHtml('suggestions'),/basic:juice-apple/);
 assert.match(app.elementHtml('suggestions'),/Marke egal/);
 await app.click('add-product',{id:'basic:juice-apple'});
 await app.click('tab',{tab:'plan'});
 assert.match(app.html(),/House Apfelsaft klar/);assert.match(app.html(),/Gesamtpreis/);assert.match(app.html(),/1,49/);
 const saved=app.storage.get('sparnah-v1');
 assert.equal(JSON.parse(saved).base.items[0].product.title,'Apfelsaft');
 const reloaded=openApp({...options,savedModel:saved});
 await reloaded.click('tab',{tab:'plan'});
 const day=reloaded.html().match(/data-action="start-shopping" data-store="shop" data-day="([^"]+)"/)[1];
 await reloaded.click('start-shopping',{store:'shop',day});
 assert.match(reloaded.html(),/House Apfelsaft klar/);
 assert.match(reloaded.html(),/data-shopping-item="basic:juice-apple"/);
});


test('a backup keeps a stable basic wish when the catalogue already has an equivalent suggestion',async()=>{
 const butter=require('../site/choices.js').basicWishes().find(p=>p.id==='basic:butter');
 const app=openApp({configureFixture(data,model){
  data.catalog.products.push({id:'butter',title:'Butter',groupId:'butter',brand:'',variantId:null,pack:{min:250,max:250,unit:'g'}});
  model.base.items=[];
 }});
 app.input({id:'search',value:'Butter'});
 assert.doesNotMatch(app.elementHtml('suggestions'),/data-id="basic:butter"/);
 const saved={schemaVersion:1,state:{items:[{id:butter.id,product:butter,qty:2}],offers:[]}};
 app.change({id:'backup-file',files:[{size:500,text:async()=>JSON.stringify(saved)}]});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(app.elementHtml('dialog-content'),/Sicherung zur Liste hinzufügen/);
 app.confirmImport();
 const restored=JSON.parse(app.storage.get('sparnah-v1')).base.items[0];
 assert.equal(restored.id,'basic:butter');assert.equal(restored.qty,2);assert.deepEqual(restored.product,butter);
});
