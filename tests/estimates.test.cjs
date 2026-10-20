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
const reference=(extra={})=>({id:'ref:cream',label:'ACME Vanillecreme',brand:'ACME',category:'Desserts',pack:{min:200,max:200,unit:'g'},cents:129,
 sourceUrl:'https://example.org/cream',sourceLabel:'Datiertes Onlinebeispiel',reviewedAt:'2026-10-20',reviewDue:'2027-04-20',...extra});
const product=(extra={})=>({id:'catalog:cream',title:'ACME Vanillecreme',brand:'ACME',category:'Desserts',pack:{min:200,max:200,unit:'g'},...extra});
test('snapshot IDs provide dated rounded budgets and cannot become current offers',()=>{
 const row=reference(),p=product({id:row.id}),G2=G.createEstimator([p],{entries:[{...row,storeId:'shop',priceCents:129,verification:'verified'}]});
 const e=G2.estimate(p,3);
 assert.equal(e.basis,'exact');assert.equal(e.cents,130);assert.equal(e.total,390);
 assert.equal(e.referenceCents,129);assert.equal(e.referenceCount,1);assert.equal(e.sourceLabel,'Datiertes Onlinebeispiel');
 assert.equal(e.reviewedAt,'2026-10-20');assert.equal(e.stale,false);
 assert.equal(G2.estimate(p,1,'2027-04-20').stale,true);
 assert.equal(e.storeId,undefined);assert.equal(e.priceCents,undefined);assert.equal(e.verification,undefined);
 assert.equal(E.offerUsable(e,1),false);
});
test('similar references prefer title, brand and size while a group never impersonates an exact item',()=>{
 const p=product(),row=reference();
 const other=reference({id:'ref:other',label:'ACME Karamellcreme',cents:999});
 const estimator=G.createEstimator([p],{entries:[row,other]});
 const e=estimator.estimate(p);
 assert.equal(e.basis,'similar');assert.equal(e.cents,130);assert.equal(e.referenceCount,1);
 assert.match(e.explanation,/kein Preisnachweis/);
 const group=product({id:row.id,isGroupChoice:true});
 assert.equal(G.createEstimator([group],{entries:[row]}).estimate(group).basis,'similar');
 const vegan=product({id:row.id,vegan:true});
 assert.equal(G.createEstimator([vegan],{entries:[row]}).estimate(vegan),null);
});
test('coarse category median is explicit, has a range and excludes arbitrary custom products',()=>{
 const p=product({title:'Unbeschriebener Nachtisch',pack:{min:200,max:200,unit:'g'}});
 const estimator=G.createEstimator([p],{entries:[reference({cents:100}),reference({id:'ref:2',label:'Schokopudding',cents:300})]});
 const e=estimator.estimate(p);
 assert.equal(e.basis,'category');assert.equal(e.sourceLabel,'Grobe Kategorie-Schätzung');
 assert.equal(e.cents,200);assert.equal(e.rangeLow,100);assert.equal(e.rangeHigh,300);
 assert.match(e.explanation,/Median von 2/);
 assert.equal(estimator.estimate({...p,id:'free:unknown'}),null);
 const custom={...p,id:'custom:something'};
 assert.equal(G.createEstimator([custom],{entries:[reference()]}).estimate(custom),null);
 const coverage=estimator.coverage();
 assert.deepEqual([coverage.total,coverage.estimated,coverage.category,coverage.missing],[1,1,1,0]);
});
test('mixed promotional and broad marketing categories never supply unrelated prices',()=>{
 const kettle=product({title:'Wasserkocher',category:'Weitere Angebote',pack:{min:1,max:1,unit:'St.'}});
 const toy=reference({label:'Bauklötze',category:'Weitere Angebote',pack:{min:1,max:1,unit:'St.'}});
 const estimator=G.createEstimator([kettle],{entries:[toy]});
 assert.equal(estimator.estimate(kettle),null);
 assert.equal(estimator.coverage().missingReasons['Sammelkategorie ohne vergleichbare Preisreferenz'],1);
 const milk=product({title:'Unbenannte Bio-Lebensmittel',category:'Bio-Produkte',pack:null});
 assert.equal(G.createEstimator([milk],{entries:[reference({category:'Bio-Produkte'})]}).estimate(milk),null);
});
test('weight, volume, pieces and sheets are separate dimensions, and absent pack is disclosed',()=>{
 const p=product({pack:null}),estimator=G.createEstimator([p],{entries:[reference()]});
 const assumed=estimator.estimate(p);
 assert.equal(assumed.assumedPack,true);assert.equal(assumed.pack.min,200);assert.match(assumed.explanation,/angenommen 200 g/);
 for(const unit of ['ml','St.','Blatt','Wl']){
  assert.equal(estimator.estimate({...p,pack:{min:200,max:200,unit}}),null,unit);
  const piece=product({pack:{min:4,max:4,unit}}),ref=reference({pack:{min:2,max:2,unit}});
  const e=G.createEstimator([piece],{entries:[ref]}).estimate(piece);
  assert.equal(e.pack.unit,unit);assert.equal(e.cents,260);
 }
 assert.equal(estimator.estimate({...p,pack:{min:1,max:1,unit:'kg'}}),null);
 const range=estimator.estimate({...p,pack:{min:150,max:250,unit:'g'}});
 assert.equal(range.assumedRange,true);assert.equal(range.assumedPack,false);
 assert.equal(range.pack.min,200);assert.ok(range.rangeLow<range.rangeHigh);
 assert.match(range.explanation,/150–250 g/);
});
test('saved shopping-list packs survive catalog changes and cached estimates cannot be mutated',()=>{
 const old=product({id:'ref:cream',title:'ACME Vanillecreme 200 g'}),current={...old,title:'ACME Vanillecreme 400 g',pack:{min:400,max:400,unit:'g'}};
 const estimator=G.createEstimator([current],{entries:[reference({label:current.title,pack:current.pack,cents:258})]});
 const oldValue=estimator.estimate(old),newValue=estimator.estimate(current);
 assert.equal(oldValue.cents,130);assert.equal(oldValue.pack.min,200);assert.equal(newValue.cents,260);
 oldValue.pack.min=8000;oldValue.referencePack.min=9000;oldValue.cents=10;
 assert.equal(estimator.estimate(old).cents,130);assert.equal(estimator.estimate(old).pack.min,200);
 assert.equal(estimator.estimate(old).referencePack.min,400);
});
test('future, malformed and unsuitable references are not evidence for a budget',()=>{
 const p=product(),bad=[
  reference({reviewedAt:'2026-10-21'}),reference({cents:-5}),reference({cents:12.5}),
  reference({sourceUrl:'javascript:alert(1)'}),reference({reviewedAt:'2026-02-30'}),
  reference({reviewDue:'2026-10-01'}),reference({pack:{min:0,max:200,unit:'g'}}),
  reference({pack:{min:200,max:100,unit:'g'}}),reference({pack:{min:200,max:200,unit:'kg'}})
 ];
 const estimator=G.createEstimator([p],{entries:bad});
 assert.equal(estimator.estimate(p,1,'2026-10-20'),null);
 assert.equal(estimator.estimate(p,1,'2026-02-30'),null);
 assert.equal(estimator.estimate(p,1,'not-a-date'),null);
 for(const qty of [0,-1,100,1.5,NaN,'2'])assert.equal(estimator.estimate(p,qty),null);
 const valid=G.createEstimator([p],{entries:[reference()]});
 assert.equal(valid.estimate({...p,pack:{min:NaN,max:200,unit:'g'}}),null);
 assert.equal(valid.estimate({...p,pack:null,title:'Vanillecreme 200 g 500 g'}),null);
});
test('Soba pack formats stay separate and general Soba wishes disclose the reference assumption',()=>{
 const base=product({id:'soba-group-any',title:'Nissin Soba – alle Sorten',brand:'Nissin',category:'Fertiggerichte',pack:null,isGroupChoice:true});
 const ref=reference({id:'ref:soba-bag',label:'Nissin Soba Bag Classic',brand:'Nissin',category:'Konserven & Fertiggerichte',pack:{min:109,max:109,unit:'g'},cents:149});
 const cup=reference({...ref,id:'ref:soba-cup',label:'Nissin Soba Cup Classic',pack:{min:90,max:90,unit:'g'},cents:199});
 const big={...base,id:'soba-group-big-cup',title:'Nissin Soba Big Cup'},protein={...base,id:'soba-group-protein',title:'Nissin Soba Protein'};
 const estimator=G.createEstimator([base,big,protein],{entries:[ref,cup]});
 const e=estimator.estimate(base);
 assert.equal(e.basis,'similar');assert.equal(e.assumedPack,true);assert.match(e.label,/Bag/);
 const bigValue=estimator.estimate(big);
 assert.equal(bigValue.pack.min,113);assert.equal(bigValue.assumedPack,true);assert.equal(bigValue.basis,'similar');
 assert.equal(bigValue.cents,250);assert.match(bigValue.explanation,/direkte Big-Cup-Preisgrundlage fehlt/);
 assert.equal(estimator.estimate(protein),null);
});
test('a known food family can find references across categories but a prepared meal is not dry pasta',()=>{
 const milk=product({title:'Frische Vollmilch',brand:'Other',category:'Weitere Angebote',pack:{min:1000,max:1000,unit:'ml'}});
 const ref=reference({label:'ACME Frische Vollmilch',category:'Milchprodukte & Eier',pack:milk.pack});
 assert.equal(G.createEstimator([milk],{entries:[ref]}).estimate(milk).basis,'similar');
 const pasta=product({title:'Spaghetti Bolognese',category:'Fertiggerichte',pack:{min:500,max:500,unit:'g'}});
 const dry=reference({label:'Spaghetti',category:'Nudeln & Reis',pack:pasta.pack});
 assert.equal(G.createEstimator([pasta],{entries:[dry]}).estimate(pasta),null);
});
test('summary uses requested snapshot and counts quantity, unmatched rows and estimate provenance',()=>{
 const p=product(),estimator=G.createEstimator([p],{entries:[reference()]});
 const input=[{item:{product:p,requestedProduct:{...p,pack:{min:400,max:400,unit:'g'}},qty:2}},
  {item:{product:{id:'unknown',title:'Unbekannt'},qty:1}}];
 const before=JSON.stringify(input),summary=estimator.summarize(input,'2026-10-20');
 assert.equal(summary.count,1);assert.equal(summary.remaining,1);assert.equal(summary.total,520);
 assert.equal(summary.estimates[0].estimate.basis,'similar');assert.equal(JSON.stringify(input),before);
 assert.deepEqual(estimator.summarize([], '2026-10-20'),{estimates:[],count:0,total:0,remaining:0});
});
test('bonus packs add both quantities and prepared soup yield never becomes a dry pack',()=>{
 const spread=product({title:'Nutella 750+75 g',brand:'Ferrero',pack:null,category:'Aufstriche'});
 const spreadRef=reference({label:'Nutella',brand:'Ferrero',category:'Aufstriche',pack:{min:450,max:450,unit:'g'},cents:399});
 const estimator=G.createEstimator([spread],{entries:[spreadRef]});
 const e=estimator.estimate(spread);
 assert.equal(e.pack.min,825);assert.equal(e.cents,730);assert.equal(e.assumedPack,false);
 const soup=product({title:'Knorr Quick Soup Tomaten ergibt 3 x 150 ml',brand:'Knorr',category:'Fertiggerichte',pack:null});
 const dry=reference({label:'Knorr Quick Soup Tomaten',brand:'Knorr',category:'Fertiggerichte',pack:{min:30,max:30,unit:'g'},cents:99});
 const wet=reference({id:'wet',label:'Tomatensuppe',brand:'Other',category:'Fertiggerichte',pack:{min:400,max:400,unit:'ml'},cents:199});
 const e2=G.createEstimator([soup],{entries:[dry,wet]}).estimate(soup);
 assert.equal(e2.pack.unit,'g');assert.equal(e2.pack.min,30);assert.equal(e2.assumedPack,true);
});
test('brand and prepared-food context defeat misleading ingredient words',()=>{
 const cases=[
  ['HARIBO Spaghetti','Haribo','Süßigkeiten & salzige Snacks','Fruchtgummis','Spaghetti'],
  ['BAHLSEN Russisch Brot','Bahlsen','Süßigkeiten & salzige Snacks','Kekse','Knäckebrot'],
  ['Knorr Pasta Snack Tomato Mozzarella','Knorr','Fertiggerichte','Knorr Pasta Pot Tomato','Mozzarella'],
  ['Knorr Asia Gebratene Nudeln Gemüse','Knorr','Fertiggerichte','Knorr Activ Veggie Muschelnudeln','Buttergemüse'],
  ['Gyoza Gemüse','Other','Tiefkühlung','Gyoza Hähnchen','Buttergemüse'],
  ['Corona Mexican Beer oder alkoholfrei','Corona','Getränke, Spirituosen','Bier','Sekt alkoholfrei'],
  ['WALTERGOTT Ice Cubes','Waltergott','Tiefkühlung','Eiswürfel','Lahmacun']
 ];
 for(const [title,brand,category,good,bad]of cases){
  const p=product({title,brand,category}),a=reference({label:good,brand:'Other',category,cents:200}),b=reference({id:'bad',label:bad,brand:'Other',category,cents:10000});
  const value=G.createEstimator([p],{entries:[a,b]}).estimate(p);
  assert.ok(value,title);assert.equal(value.cents,200,title);assert.notEqual(value.id,'bad',title);
 }
 const salt=product({title:'Alpensalz',category:'Saucen, Öle & Gewürze',pack:{min:1000,max:1000,unit:'g'}});
 assert.equal(G.createEstimator([salt],{entries:[reference({label:'KNORR Fix',category:salt.category,pack:{min:54,max:54,unit:'g'}})]}).estimate(salt),null);
 const brandy=product({title:'Asbach',category:'Alkoholische Getränke',pack:{min:700,max:700,unit:'ml'}});
 assert.equal(G.createEstimator([brandy],{entries:[reference({label:'Riesling',category:brandy.category,pack:{min:750,max:750,unit:'ml'}})]}).estimate(brandy),null);
});
test('reference limitations remain visible and the guide preserves the original manual examples',()=>{
 const p=product(),note='Ab-Preis; Packungspreis aus einem Mehrfachpaket abgeleitet.';
 const estimator=G.createEstimator([p],{entries:[reference({note})]});
 assert.match(estimator.estimate(p).explanation,/Ab-Preis; Packungspreis aus einem Mehrfachpaket abgeleitet/);
 assert.equal(estimator.entries.length,G.entries.length+1);
 assert.ok(estimator.entries.some(row=>row.label==='Nutella'));
});
test('brand substrings in household goods and flowers never turn them into snacks',()=>{
 const chip=reference({label:'SUNSNACKS Light Chips Classic',brand:'SUNSNACKS',category:'Weitere Angebote',pack:{min:150,max:150,unit:'g'}});
 for(const title of ['Hello World Feuchttücher','Hello World sensitive Feuchttücher','EDEKA Herzstücke Christrose','EDEKA Herzstücke Fairtrade Rosen']){
  const p=product({title,brand:null,category:'Weitere Angebote',pack:null});
  assert.equal(G.createEstimator([p],{entries:[chip]}).estimate(p),null,title);
 }
 const tuc=product({title:'TUC Original',brand:'TUC',category:'Süßigkeiten & salzige Snacks'});
 assert.equal(G.createEstimator([tuc],{entries:[chip]}).estimate(tuc).basis,'similar');
});
test('same-brand budget anchors win over a cheaper different brand; brand mismatch is explicit',()=>{
 const p=product({title:'FRoSTA Bami Goreng',brand:'FRoSTA',category:'Tiefkühlung',pack:{min:500,max:500,unit:'g'}});
 const branded=reference({label:'Hühner Frikassee',brand:'FRoSTA',category:'Tiefkühlung',pack:p.pack,cents:579});
 const cheap=reference({id:'cheap',label:'Fertiggericht Bami Goreng',brand:'Other',category:'Tiefkühlung',pack:p.pack,cents:249});
 const value=G.createEstimator([p],{entries:[branded,cheap]}).estimate(p);
 assert.equal(value.cents,580);assert.equal(value.brand,'FRoSTA');
 const coffee=product({title:'DALLMAYR Classic',brand:'Dallmayr',category:'Kaffee',pack:{min:500,max:500,unit:'g'}});
 const coffeeRef=reference({label:'Filterkaffee',brand:'AMAROY',category:'Kaffee',pack:coffee.pack,cents:599});
 const estimate=G.createEstimator([coffee],{entries:[coffeeRef]}).estimate(coffee);
 assert.match(estimate.assumptionNote,/AMAROY statt Dallmayr/);
});
test('a dietary mismatch is a labelled coarse budget within the same food type, never a substitute',()=>{
 const p=product({title:'Bio Naturjoghurt',brand:'A',category:'Milchprodukte',pack:{min:500,max:500,unit:'g'},bio:true});
 const ordinary=reference({label:'Naturjoghurt',brand:'B',category:'Milchprodukte',pack:p.pack,cents:99});
 const e=G.createEstimator([p],{entries:[ordinary]}).estimate(p);
 assert.equal(e.basis,'category');assert.match(e.assumptionNote,/Bio/);assert.match(e.assumptionNote,/Preisaufschlag ist nicht belegt/);
 assert.match(e.explanation,/abweichenden Ernährungsangaben/);assert.equal(p.bio,true);
 const oats=product({title:'Bio Haferdrink',brand:'A',category:'Milchprodukte',pack:{min:1000,max:1000,unit:'ml'},bio:true});
 const milk=reference({label:'Vollmilch',category:'Milchprodukte',pack:oats.pack});
 assert.equal(G.createEstimator([oats],{entries:[milk]}).estimate(oats),null);
});
test('food names and ingredient suffixes cannot cross product types',()=>{
 const cases=[
  ['Schweinebauch','Other','Fleisch & Fisch','Schweinefilet','Rotwein'],
  ['Kaninchenkeulen','Other','Fleisch & Fisch','Kaninchenfilet','Flammkuchen'],
  ['Butter','Other','Milchprodukte & Eier','Deutsche Butter','Butter-Croissants'],
  ['Zucker','Other','Backzutaten, Mehl & Zucker','Feinzucker','Fruchtmüsli, weniger Zucker'],
  ['Ferrero Rocher','Ferrero','Süßigkeiten & salzige Snacks','Schokopralinen','Leberpastete, Trüffel'],
  ['Äpfel','Other','Obst & Gemüse','Äpfel rot','Apfelschorle'],
  ['Essigessenz','Other','Saucen, Öle & Gewürze','Weißweinessig','Cornichons, Aceto Balsamico'],
  ['JACOBS Krönung Instantkaffee','JACOBS','Kaffee','JACOBS Löslicher Kaffee','JACOBS Coffee Caps Lungo'],
  ['PAULANER Spezi','PAULANER','Getränke','Cola-Mix','PAULANER Weißbier']
 ];
 for(const [title,brand,category,good,bad]of cases){
  const p=product({title,brand,category,pack:null});
  const a=reference({label:good,brand:good.startsWith(brand)?brand:'Other',category,cents:200});
  const b=reference({id:'bad',label:bad,brand:bad.startsWith(brand)?brand:'Other',category,cents:10000});
  const e=G.createEstimator([p],{entries:[a,b]}).estimate(p);
  assert.ok(e,title);assert.equal(e.cents,200,title);
 }
 const herbs=product({title:'FROSTA Kräuter',brand:'FRoSTA',category:'Tiefkühlkost',pack:null});
 const cheese=reference({label:'ROI DE TREFLE Fraîcho 150 g, Feine Kräuter',brand:'ROI DE TREFLE',category:'Käse',pack:{min:150,max:150,unit:'g'}});
 assert.equal(G.createEstimator([herbs],{entries:[cheese]}).estimate(herbs),null);
 const glitter=product({title:'BACK FAMILY Lebensmittel Glitter 5 g',brand:'BACK FAMILY',category:'Backzutaten, Mehl & Zucker',pack:null});
 assert.equal(G.createEstimator([glitter],{entries:[reference({label:'BACK FAMILY Streudekore, Mini-Marshmallows 20 g',brand:'BACK FAMILY',category:glitter.category,pack:{min:20,max:20,unit:'g'}})]}).estimate(glitter),null);
});
test('dry-mix references cannot publish prepared liquid volume as original pack contents',()=>{
 const p=product({id:'dry',title:'KNORR Salatkrönung 5er-Pack',brand:'KNORR',category:'Saucen, Öle & Gewürze',pack:{min:450,max:450,unit:'ml'}});
 const invalid=reference({id:p.id,label:p.title,brand:p.brand,category:p.category,pack:p.pack});
 const good=reference({id:'dry-weight',label:p.title,brand:p.brand,category:p.category,pack:{min:45,max:45,unit:'g'},cents:159});
 const estimator=G.createEstimator([p],{entries:[invalid,good]});
 assert.equal(estimator.entries.some(row=>row.id==='dry'),false);
 const e=estimator.estimate(p);
 assert.equal(e.pack.unit,'g');assert.equal(e.pack.min,45);assert.equal(e.assumedPack,true);
 assert.match(e.explanation,/450 ml bezeichnen die Zubereitung/);
 const single=reference({label:'KNORR Fix Gulasch',brand:'KNORR',category:p.category,pack:{min:45,max:45,unit:'g'}});
 assert.equal(G.createEstimator([p],{entries:[single]}).estimate(p),null);
});
test('prepared dishes, crunchy snacks, pizza aliases and oil varieties remain separate',()=>{
 const cases=[
  ['MEICA Curry King','MEICA','Fertiggerichte','Bratwurst','Zimt Chips'],
  ['Wagner Big City Salami','Wagner','Tiefkühlung','Pizza Margherita','Salami'],
  ['Sonnenblumenöl','Other','Saucen, Öle & Gewürze','Sonnenblumenöl','Olivenöl'],
  ['bioladen Mandelblättchen','bioladen','Backzutaten, Mehl & Zucker','Mandeln','Erdnusslocken']
 ];
 for(const [title,brand,category,good,bad]of cases){
  const p=product({title,brand,category,pack:null}),a=reference({label:good,brand:'Other',category,cents:200}),b=reference({id:'bad',label:bad,brand:'Other',category,cents:10000});
  const e=G.createEstimator([p],{entries:[a,b]}).estimate(p);
  assert.ok(e,title);assert.equal(e.cents,200,title);
 }
});
test('ambiguous main product names stay open instead of sharing an ingredient price',()=>{
 const cases=[
  ['GLICO Mikado-Sticks','Glico','Süßigkeiten & salzige Snacks','LORENZ Saltletts'],
  ['Voelkel Zitrone-Honig Ingwer-Shot','Voelkel','Getränke','Agavendicksaft'],
  ['Apfel Cidre aus der Normandie','Other','Alkoholische Getränke','Williams Birnenbrand'],
  ['MEINE BACKWELT Pikanter Steinofen-Käsestick','MEINE BACKWELT','Backwaren','Emmentaler'],
  ['Rama Original 60 % Fett','Rama','Milchprodukte','Joghurt 60 % Fett'],
  ['K-PURLAND Schinkengulasch','K-PURLAND','Fleisch & Fisch','Schinkenmettwurst'],
  ['MAGGI Penne Tomate Mozzarella Art','Maggi','Fertiggerichte','CUCINA Penne'],
  ['BBQ Rinder-Cevapcici','BBQ','Fleisch & Fisch','Chicken Wings'],
  ['Kalbs-Burger','Other','Fleisch & Fisch','Hähnchen-Burger'],
  ['Putenfilet','Other','Fleisch & Fisch','Hähnchenbrustfilet'],
  ['Kaninchenkeulen','Other','Fleisch & Fisch','Lammfilet'],
  ['JACOBS Kaffeekapseln','JACOBS','Kaffee','JACOBS Filterkaffee'],
  ['Mini Wiener Geflügel','Other','Fleisch & Fisch','MEIN VEGGIE TAG Veggie Würstchen'],
  ['BÜRGER Gnocchi','BÜRGER','Fertiggerichte','BÜRGER Maultaschen'],
  ['bio-verde Hummus mit Tomate und Basilikum','bio-verde','Feinkost & Konserven','Passierte Tomaten'],
  ['KINDER FERRERO Pingui 4x30g','Ferrero','Milchprodukte & Eier','Fruchtbuttermilch Dessert'],
  ['Unklare Creme Original','ACME','Weitere Angebote','ACME Original Light Chips']
 ];
 for(const [title,brand,category,bad]of cases){
  const p=product({title,brand,category,pack:null});
  const ref=reference({label:bad,brand:'Other',category,pack:{min:200,max:200,unit:'g'}});
  assert.equal(G.createEstimator([p],{entries:[ref]}).estimate(p),null,title);
 }
 const hummus=product({title:'Hummus mit Tomate und Basilikum',brand:'bio-verde',category:'Feinkost & Konserven'});
 const good=reference({label:'Hummus Classic',brand:'bio-verde',category:'Feinkost & Konserven',cents:199});
 assert.equal(G.createEstimator([hummus],{entries:[good]}).estimate(hummus).cents,200);
});
test('FRoSTA dishes use meal references and keep regular, large, premium and protein lines apart',()=>{
 const p=product({title:'FRoSTA Butter Chicken',brand:'FRoSTA',category:'Tiefkühlung',pack:{min:500,max:500,unit:'g'}});
 const refs=[
  reference({label:'FRoSTA Fertiggerichte, Butter Chicken 500 g',brand:'FRoSTA',category:p.category,pack:p.pack,cents:479}),
  reference({id:'wings',label:'Chicken Wings',brand:'JACKS FARM',category:p.category,pack:{min:750,max:750,unit:'g'},cents:399}),
  reference({id:'protein',label:'High Protein Hähnchen mit Reis und Brokkoli',brand:'FRoSTA',category:p.category,pack:p.pack,cents:599}),
  reference({id:'large',label:'Tortellini Rahmspinat XXL',brand:'FRoSTA',category:p.category,pack:{min:800,max:800,unit:'g'},cents:579})
 ];
 const large=product({title:'FRoSTA Reis Hähnchen Pfanne 800 g',brand:'FRoSTA',category:p.category,pack:{min:800,max:800,unit:'g'}});
 const estimator=G.createEstimator([p,large],{entries:refs});
 assert.equal(estimator.estimate(p).cents,480);
 assert.match(estimator.estimate(p).label,/Butter Chicken/);
 assert.equal(estimator.estimate(large).cents,580);
 assert.equal(estimator.estimate(large).id,'large');
 assert.equal(G.createEstimator([p],{entries:[refs[2]]}).estimate(p),null);
});
