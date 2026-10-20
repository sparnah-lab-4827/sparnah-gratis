/* Budget guidance only: never passed to the offer matcher or price optimizer. */
(function(root,factory){
  let references=root.SparnahEstimateReferences;
  if(typeof module==='object'&&module.exports){
    try{references=require('./estimate-references.js');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
  }
  const api=factory(references);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SparnahEstimates=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(referenceData){
  'use strict';
  const reviewedAt='2026-10-20',reviewDue='2027-04-20';
  const sources={
    dairy:'https://www.aldi-sued.de/marken/milsani',
    butter:'https://www.aldi-sued.de/produkte/milchprodukte-eier/butter-margarine/k/1588161425467099',
    milk:'https://www.aldi-sued.de/produkt/milsani-frische-vollmilch-3-5-1-l-000000000330654001',
    baking:'https://www.aldi-sued.de/produkte/backzutaten-mehl-zucker/k/1588161425467155',
    pasta:'https://www.aldi-sued.de/marken/cucina',
    spread:'https://www.aldi-sued.de/produkte/backwaren-aufstriche-cerealien/nuss-schokocreme/k/1588161425467113',
    water:'https://www.aldi-sued.de/produkte/getraenke/mineralwasser/k/1588161425467192',
    rice:'https://www.aldi-sued.de/newsroom/alle-pressemitteilungen/marke-und-produkte/2026/gutes-fuer-alle-auch-im-neuen-Jahr-aldi-setzt-neuen-tiefpreis-fuer-grundnahrungsmittel'
  };
  // Each row is a researched online price example, NOT a measured market average.
  // cents are the reference pack price excluding deposit. Aliases are exact food names.
  const rows=[
    ['Frische Vollmilch 3,5 %',95,1000,'ml','milk',['milsani'],['Vollmilch','Frische Vollmilch','Milch 3,5 %','Frische Vollmilch 3,5 %']],
    ['Deutsche Markenbutter',119,250,'g','butter',['milsani'],['Butter','Deutsche Markenbutter','Markenbutter']],
    ['Irische Butter',179,250,'g','butter',['milsani'],['Irische Butter']],
    ['Bio-Süßrahmbutter',269,250,'g','butter',['bio','gut bio'],['Bio-Butter','Bio-Süßrahmbutter','Bio Butter Süßrahmbutter']],
    ['Butterschmalz',549,500,'g','butter',['milsani'],['Butterschmalz']],
    ['Reine Buttermilch',59,500,'g','dairy',['milsani'],['Buttermilch','Reine Buttermilch']],
    ['Emmentaler am Stück',349,400,'g','dairy',['milsani'],['Emmentaler am Stück']],
    ['Emmentaler Scheiben',229,250,'g','dairy',['milsani'],['Emmentaler','Emmentaler Scheiben']],
    ['H-Schmand',79,200,'g','dairy',['milsani'],['Schmand','H-Schmand']],
    ['Kaffeesahne 12 %',69,200,'g','dairy',['milsani'],['Kaffeesahne 12 %','Kaffeesahne Kännchen 12%']],
    ['Laktosefreie H-Sahne',99,200,'g','dairy',['milsani'],['Laktosefreie H-Sahne']],
    ['Naturjoghurt 3,5 %',89,600,'g','dairy',['milsani'],['Naturjoghurt 3,5 %','Milder Naturjoghurt 3,5 %']],
    ['Käse-Aufschnitt',189,250,'g','dairy',['milsani'],['Käse-Aufschnitt']],
    ['Maasdamer Scheiben',239,300,'g','dairy',['milsani'],['Maasdamer','Maasdamer Scheiben']],
    ['Weizenmehl Type 405',59,1000,'g','baking',['back family','goldähren'],['Weizenmehl Type 405','Qualitäts-Weizenmehl Type 405','Mehl Type 405']],
    ['Dinkelmehl Type 1050',109,1000,'g','baking',['back family'],['Dinkelmehl Type 1050','Dinkelmehl Dinkel Type 1050']],
    ['Dinkelvollkornmehl',109,1000,'g','baking',['back family'],['Dinkelvollkornmehl','Dinkelmehl Dinkelvollkorn']],
    ['Würfelzucker',139,1000,'g','baking',['diadem'],['Würfelzucker']],
    ['Puderzucker',49,250,'g','baking',['diadem'],['Puderzucker']],
    ...['Spaghetti','Penne','Fusilli','Farfalle'].map(name=>[name,69,500,'g','pasta',['cucina','cucina nobile'],[name]]),
    ['Lasagneblätter',119,500,'g','pasta',['cucina','cucina nobile'],['Lasagneblätter']],
    ['Mascarpone',179,250,'g','pasta',['cucina'],['Mascarpone']],
    ['Büffelmozzarella Minis',199,150,'g','pasta',['cucina'],['Büffelmozzarella Minis']],
    ['XXL-Pizzateig',129,550,'g','pasta',['cucina'],['XXL-Pizzateig']],
    ['Pinsa',199,230,'g','pasta',['cucina'],['Pinsa']],
    ['Nutella',399,450,'g','spread',['ferrero','nutella'],['Nutella']],
    ['Nuss-Nougat-Creme',199,400,'g','spread',['nusskati'],['Nuss-Nougat-Creme','Nuss Nougat Creme']],
    ['Erdnusscreme Creamy',170,340,'g','spread',['grandessa'],['Erdnusscreme Creamy']],
    ['Erdnusscreme Crunchy',170,340,'g','spread',['grandessa'],['Erdnusscreme Crunchy']],
    ['Mineralwasser Classic',29,1500,'ml','water',['quellbrunn'],['Mineralwasser Classic','Natürliches Mineralwasser Classic']],
    ['Mineralwasser Medium',29,1500,'ml','water',['quellbrunn'],['Mineralwasser Medium','Natürliches Mineralwasser Medium']],
    ['Parboiled Reis',139,1000,'g','rice',['bon-ri'],['Parboiled Reis','Parboiled-Reis']],
    ['Langkornreis im Kochbeutel',79,500,'g','rice',['bon-ri'],['Langkornreis im Kochbeutel','Langkornreis Kochbeutel']]
  ];
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9%]+/g,' ').trim().replace(/\s+/g,' ');
  const entries=rows.map(([label,cents,amount,unit,source,brands,aliases],i)=>({
    id:'guide-'+i,label,cents,pack:{min:amount,max:amount,unit},sourceUrl:sources[source],
    brands:brands.map(norm),aliases:aliases.map(norm),reviewedAt,reviewDue
  }));
  function manualEstimate(product,qty=1,today=reviewedAt){
    if(!product||!Number.isInteger(qty)||qty<1||qty>99||today<reviewedAt)return null;
    const brand=norm(product.brand);
    // Only remove explicit quantities; do not discard preparation, flavour or diet words.
    const title=norm(String(product.title||'').replace(/\b(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)\b/gi,''));
    const found=entries.find(row=>{
      if(brand&&!row.brands.includes(brand))return false;
      const titles=[title,...row.brands.filter(b=>title.startsWith(b+' ')).map(b=>title.slice(b.length+1))];
      if(!titles.some(t=>row.aliases.includes(t)))return false;
      if(product.line&&!titles.some(t=>t.includes(norm(product.line))))return false;
      const flags=[['bio','bio'],['lactoseFree','laktosefrei'],['glutenFree','glutenfrei'],['vegan','vegan']];
      if(flags.some(([flag,text])=>product[flag]===true&&!norm(row.label).includes(text)))return false;
      if(Array.isArray(product.dietaryLabels)&&product.dietaryLabels.some(x=>!norm(row.label).includes(norm(x))))return false;
      return true;
    });
    if(!found)return null;
    const sizes=[...String(product.title||'').matchAll(/\b(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/gi)];
    if(sizes.length>1)return null;
    const size=sizes[0],amount=size?Number(size[2].replace(',','.'))*Number(size[1]||1)*(/^(kg|l)$/i.test(size[3])?1000:1):null;
    const titlePack=size?{min:amount,max:amount,unit:/^(kg|g)$/i.test(size[3])?'g':'ml'}:null;
    const pack=product.pack||titlePack||found.pack;
    if(!Number.isFinite(pack.min)||pack.min<=0||pack.min!==pack.max||pack.unit!==found.pack.unit)return null;
    const ratio=pack.min/found.pack.min;
    if(ratio<0.5||ratio>2)return null;
    const cents=Math.round(found.cents*ratio/5)*5; // Display a rough budget, not cent-exact certainty.
    return {...found,referenceCents:found.cents,referencePack:found.pack,pack,cents,total:cents*qty,qty,
      assumedPack:!product.pack&&!titlePack,scaled:ratio!==1,stale:today>=reviewDue,
      basis:isGroup(product)?'similar':'exact',sourceLabel:'Recherchiertes Preisbeispiel',referenceCount:1,
      explanation:'Gerundetes Budget aus einem recherchierten Preisbeispiel; kein bestätigter Händlerpreis.'};
  }
  const units=new Set(['g','ml','St.','Blatt','Wl']);
  const canonicalUnit=unit=>unit==='St'?'St.':/^wl$/i.test(unit||'')?'Wl':unit;
  const validDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
  function validPack(pack){
    return !!pack&&units.has(canonicalUnit(pack.unit))&&Number.isFinite(pack.min)&&Number.isFinite(pack.max)&&pack.min>0&&pack.max>=pack.min&&pack.max<=100000;
  }
  const middle=pack=>(pack.min+pack.max)/2;
  const rounded=cents=>Math.max(5,Math.round(cents/5)*5);
  function median(values){const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;return n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;}
  const quantityPattern=/\b(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|st[üu]ck|st\.?|blatt|wl)(?=\s|$|[,;()])/gi;
  function namedPack(title){
    const raw=String(title||'');
    const bonus=raw.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)?\s*\+\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
    if(bonus){
      const firstUnit=(bonus[2]||bonus[4]).toLowerCase(),secondUnit=bonus[4].toLowerCase();
      const unit=/^(kg|g)$/.test(firstUnit)?'g':'ml';
      if(unit!==(/^(kg|g)$/.test(secondUnit)?'g':'ml'))return {pack:null,ambiguous:true};
      const amount=Number(bonus[1].replace(',','.'))*(/^(kg|l)$/.test(firstUnit)?1000:1)+Number(bonus[3].replace(',','.'))*(/^(kg|l)$/.test(secondUnit)?1000:1);
      if([...raw.replace(bonus[0],'').matchAll(quantityPattern)].length)return {pack:null,ambiguous:true};
      return {pack:{min:amount,max:amount,unit},ambiguous:false};
    }
    // Prepared volume is not the net weight of a dry soup pack.
    const drySoup=/quick\s*soup|heisse tasse|heiße tasse|feinschmecker\s*suppe|suppentasse/i.test(raw);
    const matches=[...raw.replace(/\bergibt\b.*$/i,'').matchAll(quantityPattern)].filter(match=>!drySoup||!/^(?:ml|l)$/i.test(match[3]));
    if(matches.length!==1)return {pack:null,ambiguous:matches.length>1};
    const m=matches[0],unit=/^(kg|g)$/i.test(m[3])?'g':/^(ml|l)$/i.test(m[3])?'ml':/^blatt$/i.test(m[3])?'Blatt':/^wl$/i.test(m[3])?'Wl':'St.';
    const amount=Number(m[1]||1)*Number(m[2].replace(',','.'))*(/^(kg|l)$/i.test(m[3])?1000:1);
    return {pack:{min:amount,max:amount,unit},ambiguous:false};
  }
  function cleanTitle(product){
    let title=norm(String(product.title||product.label||'').replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)?\s*\+\s*\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)\b/gi,' ').replace(quantityPattern,' '));
    const brand=norm(product.brand);
    if(brand&&title.startsWith(brand+' '))title=title.slice(brand.length+1);
    return title;
  }
  function primaryTitle(product){
    const maker=norm(product.brand),fragments=String(product.title||product.label||'').split(/,(?!\d)/).map(norm).filter(Boolean);
    if(fragments[0]===maker&&fragments.length>1)fragments.shift();
    return cleanTitle({...product,title:fragments[0]||''});
  }
  function diet(product){
    const text=norm([product.title||product.label,product.line,...(Array.isArray(product.dietaryLabels)?product.dietaryLabels:[])].join(' '));
    return [
      product.bio===true||/\bbio\b|\bbioland\b|\borganic\b/.test(text)?'bio':'',
      product.vegan===true||/\bvegan\w*|\b(?:hafer|soja|mandel|reis)drink\b/.test(text)?'vegan':'',
      product.vegetarian===true||/\bvegetar\w*|\bveggie\b/.test(text)?'vegetarian':'',
      product.lactoseFree===true||/\blakto[sz]efrei\w*|\bohne lakto[sz]e\b/.test(text)?'lactose-free':'',
      product.glutenFree===true||/\bglutenfrei\w*|\bohne gluten\b/.test(text)?'gluten-free':'',
      /\bzuckerfrei\w*|\bohne zucker\b/.test(text)?'sugar-free':''
    ].join(':');
  }
  const categoryAliases={
    'tiefkuhlkost':'tiefkuhlung','fertiggerichte':'konserven fertiggerichte','konserven und fertiggerichte':'konserven fertiggerichte',
    'milchprodukte':'milchprodukte eier','milch eier':'milchprodukte eier','sussigkeiten':'sussigkeiten salzige snacks',
    'obst gemuse':'obst gemuse','kaffee tee':'kaffee kakao tee','pasta reis':'nudeln reis',
    'molkereiprodukte fette':'milchprodukte eier','kuhlregal':'milchprodukte eier','kase molkereiprodukte':'milchprodukte eier',
    'obst gemuse pflanzen':'obst gemuse','fleisch geflugel wurst':'fleisch fisch','fleisch':'fleisch fisch','fisch':'fleisch fisch',
    'getranke spirituosen':'alkoholische getranke','wein spirituosen':'alkoholische getranke','alkoholfreie getranke':'getranke',
    'kaffee tee susswaren knabberartikel':'sussigkeiten salzige snacks','susses snacks':'sussigkeiten salzige snacks',
    'feinkost konserven':'konserven fertiggerichte','fertiggerichte salate':'konserven fertiggerichte',
    'brot backwaren':'backwaren aufstriche cerealien','backerei':'backwaren aufstriche cerealien','fruhstuck':'backwaren aufstriche cerealien',
    'kochen backen':'backzutaten mehl zucker','bier biermischgetranke':'alkoholische getranke'
  };
  function categoryKey(value){const key=norm(value).replace(/\bund\b/g,'').replace(/\s+/g,' ').trim();return categoryAliases[key]||key;}
  const broadCategories=new Set(['','weitere angebote','sonstiges','sonstige','lebensmittel','produkte','sortiment','bio produkte','fairtrade produkte','vegetarisch vegan','haushalt']);
  const categoryMedianAllowed=new Set(['desserts','pudding','naturjoghurt','butter','milch','eier','mineralwasser','kaffee','tee','toilettenpapier','kuchenrollen','speisesalz']);
  const stopWords=new Set('und oder mit ohne der die das ein eine fein feine feiner frisch frische frischer original classic verschiedene sorten alle sorte premium gourmet bio vegan vegetarisch extra xxl big bag cup protein pro beutel packung je am im zum zumal nach art alkoholfrei glutenfrei laktosefrei traditionell klassisch spezial top mild natur style'.split(' '));
  function words(title){return new Set(title.split(' ').filter(word=>word.length>=3&&!/^\d/.test(word)&&!stopWords.has(word)));}
  // Ordered product families guide budgets only, never shopping substitutions.
  // Exclusions keep ingredients, prepared meals and household goods apart.
  const familyRules=[
    ["soba","soba.*protein",null],
    ["soba","soba.*big",null],
    ["soba","soba.*(?:cup|wok style)",null],
    ["soba","soba.*(?:bag|beutel)|bag yakisoba",null],
    ["soba","\\bsoba\\b",null],
    ["instant-ramen-bag","demae|ramen|yumyum","soba|suppenbasis|sauce"],
    ["instant-noodle-cup","cup noodles|fusion noodles|asia noodles.*(?:becher|portion)|instantnudel.*(?:becher|cup)",null],
    ["instant-pasta-pot","pasta.*(?:pot|snack|becher)|kartoffel.*(?:pot|snack)",null],
    ["dry-pasta-meal","spaghetteria|huttenschmaus|activ veggie|gebratene nudeln|asia teriyaki",null],
    ["dry-soup","quick soup|feinschmeckersuppe|feinschmecker suppe|suppentasse|suppen.*beutel|suppe.*beutel",null],
    ["canned-pasta","ravioli|raviolo|raviolini","frisch|tiefkuhl"],
    ["frozen-ready-meal","frosta.*(?:pfanne|frikassee|curry|goreng|gerich|pasta|linguine|spaghetti|protein|asian|carte|vegane|hahnchen|rigatoni|tortellini|pappardelle)|reisgericht|couscous.?pfanne",null],
    ["pizza","pizza|piccolinis|die backfrische","pizzateig|pizzaboden|pizzasauce|pizzakase|pizzastick"],
    ["filled-asian-dumplings","gyoza|samosa|fruhlingsroll",null],
    ["fresh-filled-pasta","tortelloni|tortellini|ravioli.*frisch","frosta|sauce|pfanne"],
    ["plain-dry-pasta","nudeln|spaghetti|fusilli|farfalle|penne|rigatoni|tagliatelle|lasagneblatt|reisnudel","instant|soba|ramen|suppe|sauce|pfanne|salat|goreng|carbonara|bolognese|gerich|knorr|frosta"],
    ["rice-dry","parboiled|basmatireis|jasminreis|langkornreis|kochbeutel|\\breis\\b","milchreis|drink|pfanne|gerich|risotto|reisnudel|bratreis|crisp|waffel|kugel|snack|salat|rice"],
    ["lentils-beans-dry","h[uü]lsenfrucht|linsen|schalerbse|kichererbs","salat|gerich|pfanne|suppe|eintopf|konserve|dose"],
    ["rice-wafer","reiswaffel|mais[w]?affel|kornwaffel",null],
    ["sweet-spread","nutella|nuss.?nougat.?creme|haselnusscreme|schokocreme","croissant|keks|riegel|gefullt|biscuits|snack|b.ready"],
    ["peanut-spread","erdnuss(?:creme|butter)|peanut butter",null],
    ["fruit-jam","konfiture|marmelade|fruchtaufstrich","gefullt|keks|riegel"],
    ["honey-syrup","honig|agavendicksaft|ahornsirup","senf|nuss|joghurt|keks|riegel|hahnchen|schinken|honigmelone"],
    ["flour","mehl|backmischung","paniermehl|kuchen|muffin|brotbackmischung"],
    ["plain-sugar","zucker|zimtstreuer","zuckerfrei|zuckerzusatz|zuckerarm|zuckerreduziert|zuckerfigur|puder|vanillin|vanille|bonbon"],
    ["powdered-sugar","puderzucker",null],
    ["baking-powder-yeast","backpulver|trockenhefe|frischhefe|vanillinzucker|vanillezucker",null],
    ["baking-decor","backdekor|streudekor|dekorschrift|glimmer|glitzerglasur|knusperperle|marzipan sterne|pumpspray|streusel.liebe|zuckerfigur",null],
    ["dessert-powder","paradies creme|mousse au chocolat|puddingpulver|seelenwarmer","loffelgluck|kuhlung"],
    ["salt","\\bsalz\\b|alpensalz|jodsalz|tafelsalz|salinensalz","salzbrezel|salzstang|salzgeb|gesalzen|salzig|salzmandel|salzmisch|tofu|umami|salzburger"],
    ["dry-spices","gewurz|pfeffer|zimt|sternanis|nelken|curry|paprika scharf","salz|nuss|mariniert|sauce|fix|currywurst|currystar|frosta|reis|ramen|gerich|pfanne"],
    ["dry-sauce-mix","\\bfix\\b|bratensauce|salat.?kronung|salatsauce","ben.s|sauce.*glas"],
    ["oil","olivenol|sonnenblumenol|rapsol|sesamol|erdnussol|leinol|speiseol|cooking oil|kokosol",null],
    ["vinegar","essig|balsamico","salat|kartoffel|essig.ol"],
    ["ketchup-mayo","ketchup|mayonnaise|remoulade|burger.sauce","salat"],
    ["soy-sauce","sojasauce|pokesauce|teriyakisauce|ramen suppenbasis",null],
    ["mustard","senf","wurst|weisswurst|honig|senfgurke|senf.zwiebel"],
    ["pasta-sauce","pesto|bolognese.*sauce|pasta sauce|pastasauce|tomatensauce","ravioli|nudel|pizza|knorr|spaghetteria"],
    ["tomato-puree","tomatenmark|passierte tomaten|stuckige tomaten|gehackte tomaten|pizzatomaten",null],
    ["vegetable-preserve","gemusemais|mais.*dose|erbsen.*mohren|silberzwiebel|gewurzgurke|cornichon|salatgurke.*glas|gerostete paprika|kidney.?bohne|weisse bohne|gemusevariation","frisch|salat|snack"],
    ["canned-fruit","apfelmus|apfelmark|pfirsich.*dose|fruchtcocktail|obstmix|ananas.*dose|aprikose.*dose",null],
    ["coconut-milk","kokos(?:nuss)?milch",null],
    ["prepared-soup","feinkostsuppe|eintopf|bihunsuppe|peking.?suppe|gulaschsuppe","quick|trocken|pulver|knorr.*beutel"],
    ["instant-coffee","loslicher kaffee|instant kaffee|tassenportion|nescafe|cappuccino.*pulver",null],
    ["coffee-capsules","kaffeekapsel|nespresso",null],
    ["coffee-pads","kaffeepad|senseo","drink"],
    ["dry-coffee","kaffee|espresso|prodomo|caffe|crema.*bohne|bohne.*crema","kaffeesahne|kaffeemilch|kaffeedrink|eiskaffee|kaffeeweisser|likor|cream|kapsel|pad"],
    ["tea","\\btee\\b|fruchtetee|krautertee|landertee|gruner tee|schwarzer tee|me[ss]{2}mer|teekanne|teebeutel","eistee|ice tea|icetea|iced tea"],
    ["iced-tea","eistee|ice tea|icetea|iced tea|ice.?tea",null],
    ["energy-drink","energy|red bull|crazy wolf|monster","riegel"],
    ["cola-soft-drink","coca.cola|fanta|sprite|schwip schwap|pepsi|cola|limonade|orangina|moloko","cola-flasch|fruchtgummi"],
    ["juice","fruchtsaft|apfelsaft|orangensaft|multivitaminsaft|direktsaft|valensina|hohes c|nektar|smoothie|happy day|granini","joghurt|bonbon|kaubonbon|riegel"],
    ["mineral-water","mineralwasser|quellwasser|pro aqua|naturelle|volvic|san pellegrino","aroma|zitrone|limette|frucht"],
    ["flavored-water","aromawasser|wasser.*(?:zitrone|limette|frucht)|active water",null],
    ["beer","bier|pils|helles|export|lagerbier|benediktiner|grevensteiner|duckstein|faxe|stephans brau|paulaner|radler|krombacher|veltins|bitburger|\\bbeer\\b|corona|budweiser|sch[eö]fferhofer|bayreuther",null],
    ["wine","wein|riesling|burgunder|merlot|barolo|zweigelt|dornfelder|cabernet|chianti","weinbrand|essig|schokolade"],
    ["sparkling-wine","prosecco|sekt|cava|champagner","praline|truffel"],
    ["spirits-whisky","whisk|bourbon|scotch",null],
    ["spirits-vodka","wodka|vodka|three sixty",null],
    ["spirits-gin","\\bgin\\b|tanqueray",null],
    ["spirits-rum-brandy","\\brum\\b|asbach|metaxa|weinbrand|calvados|aquavit|veterano|edelbrand",null],
    ["spirits-liqueur","baileys|amarula|cointreau|fernet|unicum|likor|pastis|triple sec|aperol|ramazzotti|amaretto","eis|kuchen|praline|schoko"],
    ["plant-drink","haferdrink|mandeldrink|sojadrink|reisdrink|oatly|alpro.*drink|hafer.?drink|mandel.?drink","joghurt"],
    ["yogurt-drink","activedrink|actimel|ayran|joghurtdrink|kefir",null],
    ["coffee-milk-drink","kaffeedrink|cappuccino.*(?:ml|drink)|latte macchiato.*(?:ml|drink)|eiskaffee",null],
    ["flavored-milk-drink","milchdrink|mullermilch|milchshake|shake|kakao.*(?:ml|drink)","proteinpulver"],
    ["milk","vollmilch|frischmilch|weidemilch|h.milch|haltbare milch|frische milch|fettarme milch","schoko|butter|kondens|kaffee"],
    ["buttermilk","buttermilch",null],
    ["cream","schlagsahne|schlagrahm|cremefine|culinesse|kochcreme|h.sahne","kase|pudding|sauce|eis"],
    ["coffee-cream","kaffeesahne|kondensmilch|kaffeemilch",null],
    ["sour-cream","schmand|saure sahne|creme fraiche|cr[eè]me fra[iî]che",null],
    ["butter","butter|die extrazarte","erdnuss|krauter|butterschmalz|buttermilch|butterkase|butterkeks|buttercroissant|buttertoast|butter.chicken|butterstollen|buttergeback|butterspatzle"],
    ["clarified-butter","butterschmalz|butaris",null],
    ["herb-butter","krauter.?butter|knoblauchbutter",null],
    ["margarine","margarine|deli reform|streichzart|streichfett|rama das original",null],
    ["yogurt","joghurt|jogurt|skyr","drink|riegel|schokolade|schnitte|waffel"],
    ["quark","\\bquark\\b|speisequark|fruchtequark","brot|tasche|kuchen"],
    ["refrigerated-dessert","pudding|milchreis|grutze|dessert|\\bmonte\\b|maxi king|kinder pingui","pulver|paradies|seelenwarmer|mousse au chocolat|dessert.so[sß]e"],
    ["dessert-sauce","dessert.?so[sß]e|vanillesauce",null],
    ["fresh-cheese","frischkase|philadelphia|bresso|arla buko|ziegencreme|hutt[e]?nkase|edelcreme|kasezubereitung",null],
    ["mozzarella","mozzarella","pizza|tortell|nudel|sauce|snack|panier"],
    ["feta","feta|hirtenkase|schafkase|weisskase","salat"],
    ["soft-cheese","camembert|weichkase|ofenkase|rougette|brie\\b|carre gourmet",null],
    ["hard-cheese","kase|emmentaler|maasdamer|gouda|cheddar|old amsterdam|parmesan|grana padano|babybel|cheestrings|fol epi","kasekuchen|sauce|wurst|pizza|tortell|pfanne|nudel|snack|sup pe"],
    ["eggs","\\beier\\b|freilandeier|bodenhaltung",null],
    ["tofu","\\btofu\\b","gewurz|tofu salz"],
    ["vegan-meat","vegan.*(?:schinken|spicker|schnitzel|hack|burger|wurst|fleisch)|fleischalternative|vegetar.*(?:schinken|wurst|schnitzel|hack)","gerich|sauce"],
    ["poultry-raw","hahnchen|huhner|puten|truthahn|perlhuhn|poularde|entenbrust|barbarie.ente|gans","pfanne|gerich|nudel|sauce|curry|salat|schnitte|aufschnitt|pizza|snack|teriyaki|frosta"],
    ["beef-raw","rinder|rindfleisch|rindergulasch|kalbsmedaillon|roastbeef","wurst|salami|schinken|aufschnitt|salat|cevapcici|hack"],
    ["pork-raw","schweine|schweinefilet|kotelett|nackensteak|schnitzel","nugget|wurst|schinken|aufschnitt|salami|vegan"],
    ["mince","hackfleisch|hackepeter|gemischtes hack|tatar|mett\\b","mettend|mettwurst"],
    ["game-lamb-rabbit","lamm|hirsch|wildschwein|rehkeule|kaninchen|hasenpfanne",null],
    ["nuggets-meatballs","nuggets|frikadell|cevapcici|chicken wings|bbq.wings|hahnchen.minis",null],
    ["sausage-hot","bratwurst|wiener|bockwurst|rindswurst|weisswurst|wurstchen|deutschlander|leberkase|currywurst|currystar",null],
    ["salami","salami|stickado|salametti|cervelat","pizza|brot|sandwich|salat"],
    ["ham-cold-cuts","schinken|prosciutto|aufschnitt|mortadella|lyoner|braten.mix|karee","pizza|tortell|salat|nudel|sandwich|vegan|pfanne"],
    ["liver-spread","leberwurst|leber.pastete|streichwurst|streich minis",null],
    ["smoked-salmon","raucherlachs|graved|sturmlachs",null],
    ["salmon-raw","lachsfilet|lachsloin|lachsportion","raucher|sauce|nudel|pfanne|frosta"],
    ["white-fish","pangasius|alaska.seelachs|kabeljau|rotbarsch|zander|schlemmer.filet",null],
    ["breaded-fish","fischstabchen|backfisch|fischfrikadell|knusperfilet",null],
    ["shrimp","garnele|king prawn|scampi","pfanne|nudel|pasta|linguine|salat|frosta|sauce"],
    ["herring","hering|matjes|rollmops",null],
    ["canned-fish","thunfisch|sardine|makrele","steak|pizza|salat|pasta|aufstrich"],
    ["fish-spread","thunfisch.aufstrich|fischaufstrich|lachscreme",null],
    ["ice-cubes","ice cubes|crushed ice|eiswurfel",null],
    ["ice-cream","speiseeis|stieleis|sandwicheis|eisbecher|ice cream|magnum|nuii|mucci|scholler|cornetto|ben.*jerry","eiswurfel|ice cubes|crushed ice"],
    ["frozen-potatoes","pommes|frites|fries|herzogin.kartoffel|rosti|reibekuchen|herzogin",null],
    ["prepared-potato","knodel|klo[sß]|kartoffelgericht|kartoffelpuffer",null],
    ["fresh-dough","pizzateig|flammkuchenboden|hefeteig|blatterteig",null],
    ["bread-loaf","\\bbrot\\b|vollkornbrot|weissbrot|wurzelbrot|kornschatz|krusti|toast|ciabatta|baguette|panini|flabatta","aufstrich|brotzeit|brotchen"],
    ["bread-roll","brotchen|goldstuck|laugenstang|laugenbrezel|brezel","salzbrezel|snack|knabber|schoko"],
    ["pastry","croissant|franzbrotchen|berliner|plunder|nussschnecke|mohnschnecke|vanillestange|apfelecke|pain au chocolat|geflugelrolle|pizzastick",null],
    ["cakes-biscuits","kuchen|tortchen|torte|geback|waffel|keks|zwieback|cake|brownie|russisch.?brot|biscuits","reiswaffel|maiswaffel|kase|ofengerich"],
    ["chocolate-bars","schokoriegel|schoko.riegel|duplo|hanuta|country|knoppers|pick up|\\brace\\b|big bars","eis|ice cream"],
    ["chocolate-tablets","tafelschokolade|schokolade|milka|choceur","pralin|riegel|advent|geback|waffel|keks|eis"],
    ["chocolates-pralines","praline|rocher|giotto|toffifee|truffel|celebrations|after eight","ol|sauce|kase|nudel"],
    ["gummy-candy","haribo|trolli|fruchtgummi|lachgummi|maoam|fritt|hitschies","advent"],
    ["hard-candy","bonbon|halspastille|mingles",null],
    ["chips-snacks","chips|crunchips|pringles|flips|chitos|cornados|\\btuc\\b|crackers|knuspersnack|grissini|salzbrezel|salzstang|pretzel|mitsuba|snack.hasen|pom.b[aä]r",null],
    ["nuts","cashew|nussmix|nuss.frucht.mix|erdnuss|nicnac|ultje|walnuss|mandel","creme|butter|schokolade|kuchen|geback|riegel|brot|marzipan"],
    ["cereal-bars","musliriegel|corny|cereal.bar|proteinriegel",null],
    ["breakfast-cereal","musli|cerealien|cornflakes|fruhstucksflocke|haferflocke","riegel|panade|hahnchen"],
    ["advent-calendar","adventskalend|adventskalendar","red bull"],
    ["fresh-berries","heidelbeere|brombeere|himbeere|erdbeere","joghurt|milch|sauce|tee|saft|sirup|schoko|konfiture|pudding|quark"],
    ["fresh-apple-pear","apfel|birne","saft|mus|mark|tee|ecke|kuchen|essig|mischung|getrank|quark"],
    ["fresh-citrus","orange|clementine|mandarine|zitrone|grapefruit|pomelo","saft|likor|tee|sirup|limonade|keks|bonbon|schoko|joghurt|konfiture|limo"],
    ["fresh-banana","banane","milch|joghurt|shake|saft|tee|chip"],
    ["fresh-tropical-fruit","mango|avocado|ananas|kiwi","saft|limo|joghurt|quark|tee|sauce|schoko|dose|konserve|curry"],
    ["fresh-grapes","tafeltraube|weintraube","saft"],
    ["fresh-potato","speisekartoffel|kartoffeln","salat|pommes|suppe|gericht|brat"],
    ["fresh-onion-garlic","zwiebel|knoblauch","rostzwiebel|r[oö]st|granulat|salami|sauce|brot|dressing|rahm|wurst|silberzwiebel"],
    ["fresh-tomato-pepper","tomate|paprika","sauce|mark|passiert|gehackt|gewurz|suppe|pfanne|salat|brat|gerostet|pasta|pizza|reis|konserve"],
    ["fresh-leafy-salad","romanasalat|feldsalat|eisbergsalat|kopfsalat|salatmischung","dressing|salatmen|salatcup"],
    ["salad-ready","salatmenu|salat.men[uü]|salatcup|salatschale|kartoffelsalat|krautsalat|nudelsalat|pasta.salat|bowl","dressing"],
    ["fresh-cucumber-zucchini","salatgurke|zucchini|aubergine","salatmenu|pfanne|eintopf|gerostet|gegrillt|sauce"],
    ["fresh-cabbage-broccoli","broccoli|brokkoli|blumenkohl|rosenkohl|kohlrabi","suppe|sauce|pfanne|gerich|reis|knorr|frosta|grat"],
    ["fresh-mushrooms","champignon|pilze","suppe|sauce|pfanne|gerich|knorr|frosta|rahm"],
    ["fresh-root-veg","mohre|karotte|pastinake|sellerie|rote bete","saft|suppe|sauce|pfanne|gerich|salat|dose|eintopf"],
    ["fresh-herbs","krauter","butter|kase|quark|tee|gewurz|salz|dressing|sauce|fisch|bro[t]"],
    ["vegetable-mix","suppengemuse|gemuse pfanne|gemusemix|iglo gemuse","reis|nudel|hahnchen"],
    ["toilet-paper","toilettenpapier","kuchen"],
    ["laundry-detergent","waschmittel|perwoll|dash voll","weichspuler"],
    ["fabric-softener","weichspuler|vernel",null],
    ["dishwasher-tablets","maschinengeschirr.reiniger|finish powerball|spulmaschinentab",null],
    ["household-cleaner","sagrotan reiniger|allzweckreiniger|badreiniger|glasreiniger",null],
    ["baby-wipes","feuchttuch|feuchttucher|feuchte waschlappen",null],
    ["baking-paper","backpapier",null],
    ["pet-snacks","hunde.snack|adventuros|katzen.snack",null],
    ["candles","grabkerze|kompositions.ol.licht|st. jakobs grabkerze",null]
  ].map(([name,pattern,exclude])=>[name,new RegExp('\\b(?:'+pattern+')'),exclude?new RegExp(exclude):null]);
  function family(title,category='',brand=''){
    const context=categoryKey(category),maker=norm(brand);
    // ALDI titles usually append flavour/recipe ingredients after a comma.
    // Never classify cheese "…, Kräuter" or liver pâté "…, Trüffel" as herbs/pralines.
    const fragments=String(title).split(/,(?!\d)/).map(norm).filter(Boolean);
    if(fragments[0]===maker&&fragments.length>1)fragments.shift();
    title=fragments[0]||'';
    if(maker&&!title.startsWith(maker+' '))title=maker+' '+title;
    const productName=maker&&title.startsWith(maker+' ')?title.slice(maker.length+1):title;
    // Explicit product formats precede ingredient words and brand aliases.
    if(/\bmikado\b/.test(title))return 'chocolate-coated-biscuit-sticks';
    if(/\b(?:ingwer|ginger).?shot\b|\bshot\b/.test(title)&&/getranke|saft|obst/.test(context))return 'juice-shot';
    if(/\b(?:cidre|cider)\b/.test(title))return 'cider';
    if(/\b(?:birnenbrand|obstbrand|obstler|kirschwasser|zwetschgenwasser)\b/.test(title))return 'spirits-fruit-brandy';
    if(/\b(?:kasestick|kasestange|kasebrezel|kasecroissant)\b/.test(title))return 'savoury-cheese-pastry';
    if(/\brama\b/.test(title)&&/\boriginal\b/.test(title)&&!/\b(?:cremefine|kochcreme)\b/.test(title))return 'margarine';
    if(/\bschinkengulasch\b/.test(title))return 'pork-raw';
    if(/\bhummus\b/.test(title))return 'hummus';
    if(/\b(?:pingui|maxi king|milchschnitte)\b/.test(title))return 'refrigerated-chocolate-snack';
    if(/\bmaggi\b/.test(title)&&/\b(?:penne|pasta|fusilli|spaghetti|nudeln)\b/.test(title))return 'dry-pasta-meal';
    if(/\b(?:vegan\w*|vegetar\w*|veggie)\b/.test(title)&&/\b(?:schinken|spicker|schnitzel|hack|burger|wurst\w*|wurz?stchen|fleisch|nuggets?)\b/.test(productName))return 'vegan-meat';
    if(/\b(?:burger|cevapcici|frikadellen?)\b|(?:rinder|kalbs|schweine).?(?:burger|cevapcici|frikadellen?)/.test(productName)){
      if(/\b(?:vegan|vegetar)/.test(title))return 'vegan-meat';
      const species=/\b(?:rind|rinder|kalb|kalbs)/.test(title)?'beef':/\b(?:schwein|schweine)/.test(title)?'pork':/\b(?:hahnchen|huhner|puten|chicken)/.test(title)?'poultry':'unspecified';
      const shape=/cevapcici/.test(title)?'cevapcici':/frikadell/.test(title)?'meatballs':'burger';
      return species+'-'+shape;
    }
    if(/\b(?:chicken|hahnchen).?(?:wings|nuggets)|\bbbq.?wings\b/.test(title))return 'poultry-snack';
    if(/\bfrosta\b/.test(title)&&/\b(?:butter chicken|chicken|bratreis|reisgericht|xxl)\b/.test(title))return 'frozen-ready-meal';
    if(/haribo|trolli|katjes/.test(title+' '+maker))return 'gummy-candy';
    if(/russisch.?brot/.test(title))return 'cakes-biscuits';
    if(/aperol.*spritz|spritz.*aperol|fertig.?cocktail|cocktail.*dose/.test(title))return 'ready-cocktail';
    if(/knorr/.test(title)&&/pasta.*(?:snack|pot|becher)|kartoffel.*(?:snack|pot|becher)/.test(title))return 'instant-pasta-pot';
    if(/knorr/.test(title)&&/activ veggie|gebratene nudeln|asia teriyaki|spaghetteria/.test(title))return 'dry-pasta-meal';
    if(/(?:gyoza|samosa|fruhlingsroll)/.test(title))return 'filled-asian-dumplings';
    if(/\b(?:ouzo|tequila)\b/.test(title))return 'spirits-'+(title.includes('ouzo')?'ouzo':'tequila');
    if(/\b(?:knackebrot|knusperbrot|leicht cross)\b/.test(title))return 'crispbread';
    if(/\b(?:kurbiskerne|sonnenblumenkerne|pinienkerne)\b/.test(title))return 'seeds';
    if(/\bpopcorn\b/.test(title))return 'popcorn';
    if(/\blindor\b/.test(title))return 'chocolates-pralines';
    if(/\b(?:kaba|kakaopulver|trinkkakao)\b/.test(title))return 'cocoa-powder';
    if(/\b(?:getrankepulver|schokogetrankepulver)\b/.test(title)&&/kakao|schoko/.test(title))return 'cocoa-powder';
    if(/\bgnocchi\b/.test(title))return 'prepared-potato';
    if(/\b(?:maasdam|gruyere|appenzeller|manchego)\b/.test(title)&&!/\b(?:sauce|pizza|pfanne)\b/.test(title))return 'hard-cheese';
    if(/\b(?:kabanos|salamisticks|longhetti)\b/.test(title))return 'salami';
    if(/\b(?:curry king|curryking|currystar)\b/.test(title))return 'sausage-hot';
    if(/\b(?:erdnusslocken|erdnussflips|flips)\b/.test(title))return 'chips-snacks';
    if(/\bzimt\s*chips\b/.test(title))return 'breakfast-cereal';
    if(/\bbig city\b/.test(title)&&/wagner|pizza/.test(title+' '+maker))return 'pizza';
    if(/\bherta finesse\b/.test(title))return 'ham-cold-cuts';
    if(/\btrue dates\b|\bdatteln?\b|\brosinen\b|\bsultaninen\b/.test(title))return 'dried-fruit';
    if(/\b(?:glitter|glitzer|glimmer|dekorschrift|pumpspray)\b/.test(title))return 'decorating-icing';
    if(/\b(?:krauter|krautertee|pfefferminze|fruchtetee|tee)\b/.test(title)&&/tee|messmer|westminster|teekanne/.test(title)&&!/eistee|ice.?tea/.test(title))return 'tea';
    if(/\b(?:natur|frucht|sahne|vollmilch|rahm)?joghurt\b/.test(title)&&!/drink|schokolade|schnitte|waffel/.test(title))return 'yogurt';
    if(/\b(?:fruchte|mager|speise|gewurz)quark\b/.test(title)&&!/kuchen|tasche|brot/.test(title))return 'quark';
    if(/\b(?:frisch|schmelz|hutten)kase\w*\b/.test(title)&&!/pizza|nudel|sauce/.test(title))return 'fresh-cheese';
    if(/\b(?:fein|kristall|raffinade)zucker\b/.test(title))return 'plain-sugar';
    if(/\b(?:schoko|edel|nougat)pralinen\b/.test(title))return 'chocolates-pralines';
    if(/\b(?:instant|instantkaffee|loslich|loslicher)\b/.test(title)&&/kaffee|jacobs|nescafe|cappuccino/.test(title)&&!/kapsel|pads|coffee caps/.test(title))return 'instant-coffee';
    if(/\b(?:kaffeekapseln?|kapseln?|nespresso|coffee caps)\b/.test(title)&&/kaffee|jacobs|nescafe|espresso|cafe|tchibo|dallmayr/.test(title))return 'coffee-capsules';
    if(/\b(?:spezi|erfrischungsgetrank|limonade|limo|cola|fanta|sprite)\b/.test(title)&&!/fruchtgummi|bonbon|kaubonbon|gummibaren/.test(title))return 'cola-soft-drink';
    if(/\b(?:apfelschorle|fruchtschorle|schorle)\b/.test(title))return 'juice';
    if(/\b(?:croissants?|franzbrotchen|apfeltaschen?|berliner|plunder)\b/.test(title))return 'pastry';
    if(/\b(?:(?:frucht|korn|schoko|nuss)?musli|cornflakes|porridge|haferflocken)\b/.test(title)&&!/riegel|hahnchen|panade/.test(title))return 'breakfast-cereal';
    if(/\b(?:rotkohl|sauerkraut|grunkohl)\b/.test(title)&&!/obst gemuse/.test(context))return 'vegetable-preserve';
    if(/\b(?:cornichons?|gewurzgurken?|silberzwiebeln?)\b/.test(title)||/\bgurken\b/.test(title)&&/konserven/.test(context))return 'vegetable-preserve';
    if(/\b(?:weisswein|rotwein|tafel|branntwein|apfel|weiss)?essig(?:essenz)?\b/.test(title)&&!/salat|kartoffel|gurke/.test(title))return 'vinegar';
    if(/\b(?:krauter|fraicho|milk ana|milkana)\b/.test(title)&&context==='kase')return 'fresh-cheese';
    if(/\bfrosta\b/.test(title)&&/\b(?:bratreis|reisgericht|xxl)\b/.test(title))return 'frozen-ready-meal';
    if(/\b(?:pilsner|franziskaner|radeberger|chiemseer|pilsner urquell|becks|beck s|spaten munchner)\b/.test(title)||
      /\bhell\b/.test(title)&&/getranke|bier/.test(context))return 'beer';
    for(const [name,include,exclude]of familyRules){
      if(!include.test(title)||exclude&&exclude.test(title))continue;
      if(name.startsWith('fresh-')&&['kase','milchprodukte eier'].includes(context)&&!['fresh-cheese','fresh-dough','fresh-filled-pasta'].includes(name))continue;
      if(name==='honey-syrup'&&/\b(?:braten|fleisch|gurken?|schinken|senf)\b/.test(title))continue;
      if(name==='wine'&&/fleisch|fisch|wurst/.test(context))continue;
      if(name==='game-lamb-rabbit'&&/flammkuchen/.test(title))continue;
      if(name==='poultry-raw'){
        if(/\b(?:hahnchen|huhner|poularde)/.test(title))return 'poultry-raw-chicken';
        if(/\b(?:puten|truthahn)/.test(title))return 'poultry-raw-turkey';
        if(/\b(?:enten|barbarie)/.test(title))return 'poultry-raw-duck';
        if(/\bgans/.test(title))return 'poultry-raw-goose';
        return 'poultry-raw-guinea-fowl';
      }
      if(name==='beef-raw')return /\bkalbs/.test(title)?'veal-raw':'beef-raw';
      if(name==='game-lamb-rabbit'){
        if(/\blamm/.test(title))return 'lamb-raw';
        if(/\b(?:kaninchen|hasen)/.test(title))return 'rabbit-raw';
        if(/\bwildschwein/.test(title))return 'wild-boar-raw';
        return 'deer-raw';
      }
      if(name==='oil'){
        const oil=title.match(/\b(oliven|sonnenblumen|raps|sesam|erdnuss|lein|kokos)ol\b/);
        if(oil)return 'oil-'+oil[1];
      }
      if(name==='nuts'){
        if(/\bmandel/.test(title))return 'nuts-almond';
        if(/\berdnuss/.test(title))return 'nuts-peanut';
        if(/\bwalnuss/.test(title))return 'nuts-walnut';
        if(/\bcashew/.test(title))return 'nuts-cashew';
      }
      return name;
    }
    if(/\b(?:dallmayr|tchibo|melitta|eduscho|lavazza|jacobs)\b/.test(title+' '+maker)&&!/\b(?:drink|latte|likor|milch|sahne)\b/.test(title))return 'dry-coffee';
    if(/\b(?:activia|grosse bauer|jogobella)\b/.test(title))return /\bdrink\b/.test(title)?'yogurt-drink':'yogurt';
    // Only narrow department labels can stand in for an omitted product noun.
    if(context==='kaffee')return 'dry-coffee';
    if(context==='tee')return 'tea';
    return '';
  }
  function form(title){
    if(/\bbag yakisoba\b/.test(title))return 'bag';
    if(!/\bsoba\b/.test(title))return '';
    if(/\bprotein\b/.test(title))return 'protein';
    if(/\bbig\b/.test(title))return 'big-cup';
    if(/\bcup\b|\bwok style\b/.test(title))return 'cup';
    if(/\bbag\b|\bbeutel\b/.test(title))return 'bag';
    return 'unspecified';
  }
  function mealFormat(product){
    const title=norm(product.title||product.label),pack=product.pack;
    if(/\b(?:high.?protein|protein)\b/.test(title))return 'protein';
    if(/\ba la carte\b|\bala carte\b|\bpremium\b/.test(title))return 'premium';
    if(/\bxxl\b/.test(title)||pack?.unit==='g'&&middle(pack)>=700)return 'large';
    return 'regular';
  }
  const dryPackFamilies=new Set(['dry-soup','dry-sauce-mix','instant-pasta-pot','dry-pasta-meal','instant-ramen-bag','instant-noodle-cup','dessert-powder','cocoa-powder']);
  function prepareReference(row){
    if(!row||typeof row.id!=='string'||!row.id||!Number.isInteger(row.cents)||row.cents<=0||row.cents>1000000||
      !validPack(row.pack)||!validDate(row.reviewedAt)||!validDate(row.reviewDue)||row.reviewDue<=row.reviewedAt||
      typeof row.sourceUrl!=='string'||!/^https:\/\/[^/\s]+(?:\/|$)/.test(row.sourceUrl)||!String(row.label||row.title||'').trim())return null;
    // Explicitly copy allowed fields: priceCents/storeId/offer validity cannot leak into a budget.
    const ref={id:row.id,label:String(row.label||row.title),brand:String(row.brand||''),category:String(row.category||''),
      line:row.line||null,pack:{...row.pack,unit:canonicalUnit(row.pack.unit)},cents:row.cents,sourceUrl:row.sourceUrl,
      sourceLabel:row.sourceLabel||'Recherchiertes Preisbeispiel',note:typeof row.note==='string'?row.note:'',
      reviewedAt:row.reviewedAt,reviewDue:row.reviewDue};
    const text=cleanTitle(ref),kind=family(ref.label,ref.category,ref.brand);
    if(dryPackFamilies.has(kind)&&ref.pack.unit==='ml')return null;
    return {ref,text,words:words(primaryTitle(ref)),fullWords:words(text),category:categoryKey(ref.category),family:kind,form:form(norm(ref.label)),mealFormat:mealFormat(ref),diet:diet(row)};
  }
  function isGroup(product){
    return !!(product.isGroupChoice||product.groupSelection||/^(?:choice:|.*-group-)/.test(product.id||'')||
      product.groupId&&!product.brand&&!product.variantId&&!/^(?:assortment|import|manufacturer):/.test(product.id||''));
  }
  function sameIdentity(product,row){
    if(isGroup(product))return false;
    return cleanTitle(product)===row.text&&(!product.brand||norm(product.brand)===norm(row.ref.brand))&&
      (!product.line||norm(product.line)===norm(row.ref.line)||row.text.includes(norm(product.line)))&&diet(product)===row.diet;
  }
  function collectSummary(unknown,today,estimateFn){
    const rows=Array.isArray(unknown)?unknown:[];
    const estimates=rows.map(u=>({item:u?.item,estimate:u?.item?estimateFn(u.item.requestedProduct||u.item.product,u.item.qty,today):null})).filter(x=>x.estimate);
    return {estimates,count:estimates.length,total:estimates.reduce((sum,x)=>sum+x.estimate.total,0),remaining:rows.length-estimates.length};
  }
  const referenceIndexes=new WeakMap();
  const addToIndex=(map,key,row)=>{if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(row);};
  function referenceIndex(data){
    if(data&&typeof data==='object'&&referenceIndexes.has(data))return referenceIndexes.get(data);
    const prepared=(Array.isArray(data?.entries)?data.entries:[]).map(prepareReference).filter(Boolean);
    const byId=new Map(),byCategory=new Map(),byFamily=new Map(),byWord=new Map();
    for(const row of prepared){
      addToIndex(byId,row.ref.id,row);addToIndex(byCategory,row.category,row);addToIndex(byFamily,row.family,row);
      for(const word of row.words)addToIndex(byWord,word,row);
    }
    const index={prepared,byId,byCategory,byFamily,byWord};
    if(data&&typeof data==='object')referenceIndexes.set(data,index);
    return index;
  }
  function createEstimator(products=[],data=referenceData){
    const catalog=new Map((products||[]).filter(p=>p&&typeof p.id==='string'&&p.id&&typeof p.title==='string').map(p=>[p.id,p]));
    const {prepared,byId,byCategory,byFamily,byWord}=referenceIndex(data);
    const cache=new Map(),coverageCache=new Map();
    function calculate(product,today){
      if(!product||!validDate(today))return {value:null,reason:'Ungültiges Produkt oder Datum'};
      const productFamily=family(product.title,product.category,product.brand);
      const titled=namedPack(product.title),explicit=dryPackFamilies.has(productFamily)&&product.pack?.unit==='ml'?null:product.pack;
      if(dryPackFamilies.has(productFamily)&&titled.pack?.unit==='ml')titled.pack=null;
      if(explicit&&!validPack(explicit)||!explicit&&titled.ambiguous)return {value:null,reason:'Packungsgröße nicht eindeutig verwendbar'};
      const given=explicit||titled.pack;
      const pack=given?{...given,unit:canonicalUnit(given.unit)}:null;
      if(pack&&!validPack(pack))return {value:null,reason:'Ungültige Packungseinheit'};
      const exact=(byId.get(product.id)||[]).filter(row=>row.ref.reviewedAt<=today&&sameIdentity(product,row)&&(!pack||pack.unit===row.ref.pack.unit));
      if(exact.length)return {value:makeBudget(exact.sort((a,b)=>b.ref.reviewedAt.localeCompare(a.ref.reviewedAt)).slice(0,1),'exact',pack,product,today)};
      const manual=manualEstimate(product,1,today);
      if(manual)return {value:manual};
      if(!catalog.has(product.id)||String(product.id).startsWith('custom:'))return {value:null,reason:'Kein bekanntes Katalogprodukt'};
      const category=categoryKey(product.category),text=cleanTitle(product),productWords=words(primaryTitle(product)),fullWords=words(text),fam=productFamily,shape=form(norm(product.title)),dietKey=diet(product);
      const candidates=new Set([...(byCategory.get(category)||[]),...(byFamily.get(fam)||[])]);
      for(const word of productWords)for(const row of byWord.get(word)||[])candidates.add(row);
      const usable=row=>row.ref.reviewedAt<=today&&(!pack||pack.unit===row.ref.pack.unit);
      const compatible=row=>{
        if(!usable(row)||dietKey!==row.diet)return false;
        if(fam&&fam!==row.family)return false;
        if(fam==='frozen-ready-meal'&&row.mealFormat!==mealFormat(product))return false;
        // A 5-pack is not one sachet. Without a total net weight, only a reference
        // with the same explicit bundle count can provide the pack budget.
        const bundle=norm(product.title).match(/\b(\d+)\s*er pack\b/);
        if(!pack&&bundle&&norm(row.ref.label).match(/\b(\d+)\s*er pack\b/)?.[1]!==bundle[1])return false;
        // Cups and bags are different pack formats. A broad Soba wish may use a bag,
        // but the chosen reference and assumed pack are always disclosed.
        if(fam==='soba'&&(shape==='unspecified'?row.form!=='bag':shape!==row.form))return false;
        return true;
      };
      const ranked=[];
      for(const row of candidates){
        if(!compatible(row))continue;
        const overlap=[...productWords].filter(word=>row.words.has(word)).length;
        const similarity=overlap/Math.max(1,Math.min(productWords.size,row.words.size));
        const sharedFamily=!!fam&&fam===row.family;
        const identicalName=text===row.text&&norm(product.brand)===norm(row.ref.brand)&&category===row.category;
        // Shared generic words never establish the main product type. Unclassified
        // products stay open instead of receiving an ingredient/brand-name budget.
        if(!sharedFamily&&!identicalName)continue;
        const ratio=pack?middle(pack)/middle(row.ref.pack):1;
        const caseBeverage=pack?.unit==='ml'&&['beer','mineral-water','flavored-water','juice','cola-soft-drink','energy-drink','iced-tea','wine','sparkling-wine'].includes(fam);
        if(ratio<0.25||ratio>(caseBeverage?100:4))continue;
        const sameBrand=!!product.brand&&norm(product.brand)===norm(row.ref.brand);
        const recipeOverlap=[...fullWords].filter(word=>row.fullWords.has(word)).length;
        ranked.push({row,sameBrand,score:overlap*5+similarity*3+recipeOverlap*3+6+(sameBrand?5:0)-(Math.abs(Math.log(ratio))*2)+(shape==='unspecified'&&row.form==='bag'?2:0)});
      }
      if(ranked.some(hit=>hit.sameBrand)){
        for(let i=ranked.length-1;i>=0;i--)if(!ranked[i].sameBrand)ranked.splice(i,1);
      }
      ranked.sort((a,b)=>b.score-a.score||b.row.ref.reviewedAt.localeCompare(a.row.ref.reviewedAt)||a.row.ref.id.localeCompare(b.row.ref.id));
      if(ranked.length){
        const best=ranked[0],rows=ranked.filter(hit=>hit.score>=best.score-2&&hit.row.ref.pack.unit===best.row.ref.pack.unit).slice(0,7).map(hit=>hit.row);
        return {value:makeBudget(rows,'similar',pack,product,today)};
      }
      if(fam==='soba'&&shape==='big-cup'&&(!pack||pack.unit==='g')){
        const cups=(byFamily.get('soba')||[]).filter(row=>row.form==='cup'&&row.ref.pack.unit==='g'&&row.ref.reviewedAt<=today&&row.diet===dietKey);
        cups.sort((a,b)=>[...productWords].filter(word=>b.words.has(word)).length-[...productWords].filter(word=>a.words.has(word)).length);
        if(cups.length){
          const value=makeBudget(cups.slice(0,1),'similar',pack||{min:113,max:113,unit:'g'},product,today);
          value.assumedPack=!pack;value.scaled=true;
          value.packSourceUrl='https://www.rewe.de/shop/p/nissin-soba-nudeln-mit-yakisoba-sauce-classic-big-cup-113g/7637000';
          value.explanation=`Big Cup: ${pack?'angegebene':'angenommene'} ${value.pack.min} g, aus normalem Cup hochgerechnet; direkte Big-Cup-Preisgrundlage fehlt. ${value.explanation}`;
          return {value};
        }
      }
      if(fam==='soba')return {value:null,reason:'Keine Preisreferenz für dieses Soba-Packungsformat'};
      // The requested dietary attributes remain untouched. A dietary mismatch can
      // only supply an explicitly coarse budget within the same narrow food type.
      if(fam){
        const dietaryRows=(byFamily.get(fam)||[]).filter(row=>{
          if(!usable(row)||row.diet===dietKey)return false;
          if(fam==='frozen-ready-meal'&&row.mealFormat!==mealFormat(product))return false;
          const bundle=norm(product.title).match(/\b(\d+)\s*er pack\b/);
          if(!pack&&bundle&&norm(row.ref.label).match(/\b(\d+)\s*er pack\b/)?.[1]!==bundle[1])return false;
          const ratio=pack?middle(pack)/middle(row.ref.pack):1;
          return ratio>=0.25&&ratio<=4;
        }).map(row=>({row,score:[...productWords].filter(word=>row.words.has(word)).length*5+
          (product.brand&&norm(product.brand)===norm(row.ref.brand)?3:0)-
          (pack?Math.abs(Math.log(middle(pack)/middle(row.ref.pack))):0)}));
        dietaryRows.sort((a,b)=>b.score-a.score);
        if(dietaryRows.length){
          const best=dietaryRows[0],rows=dietaryRows.filter(hit=>hit.score>=best.score-2&&hit.row.diet===best.row.diet&&hit.row.ref.pack.unit===best.row.ref.pack.unit).slice(0,7).map(hit=>hit.row);
          const labels=['Bio','vegan','vegetarisch','laktosefrei','glutenfrei','zuckerfrei'];
          const targetDiet=dietKey.split(':'),referenceDiet=best.row.diet.split(':');
          const differences=labels.filter((_,index)=>targetDiet[index]!==referenceDiet[index]).join(', ');
          const value=makeBudget(rows,'category',pack,product,today);
          value.sourceLabel='Grobe Schätzung mit abweichenden Ernährungsangaben';
          value.assumptionNote=[value.assumptionNote,`Die Referenz weicht bei ${differences} ab; ein entsprechender Preisaufschlag ist nicht belegt. Nur ein grober Budgetwert, keine Produktalternative.`].filter(Boolean).join(' ');
          value.explanation=value.explanation.replace(/^Grobes Budget aus dem Median von .*?; Produkt und Sorte können abweichen\./,
            `Grobes Budget aus ${rows.length} Preisbeispiel${rows.length===1?'':'en'} derselben Produktart mit abweichenden Ernährungsangaben. ${value.assumptionNote}`);
          return {value};
        }
      }
      if(!categoryMedianAllowed.has(category))return {value:null,reason:'Sammelkategorie ohne vergleichbare Preisreferenz'};
      const group=(byCategory.get(category)||[]).filter(row=>usable(row)&&row.diet===dietKey&&(!fam||row.family===fam));
      if(!group.length)return {value:null,reason:'Keine passende Kategorie- und Einheitenreferenz'};
      // Without a target unit, use the most common reference unit and disclose its pack.
      const groups=new Map();for(const row of group)addToIndex(groups,row.ref.pack.unit,row);
      const common=[...groups.values()].sort((a,b)=>b.length-a.length||a[0].ref.pack.unit.localeCompare(b[0].ref.pack.unit))[0];
      return {value:makeBudget(common,'category',pack,product,today)};
    }
    function makeBudget(rows,basis,given,product,today){
      const selected=[...rows].sort((a,b)=>(a.ref.cents/middle(a.ref.pack))-(b.ref.cents/middle(b.ref.pack)));
      const anchor=selected[Math.floor((selected.length-1)/2)].ref;
      const size=given?middle(given):median(selected.map(row=>middle(row.ref.pack)));
      const pack={min:size,max:size,unit:given?.unit||anchor.pack.unit};
      const raw=selected.map(row=>row.ref.cents*size/middle(row.ref.pack)),cents=rounded(median(raw));
      const dates=selected.map(row=>row.ref.reviewedAt).sort(),due=selected.map(row=>row.ref.reviewDue).sort();
      const assumedRange=!!(given&&given.min!==given.max)||selected.some(row=>row.ref.pack.min!==row.ref.pack.max);
      const rangeValues=raw.concat(given?[cents*given.min/size,cents*given.max/size]:[]);
      const sourceLabel=basis==='category'?'Grobe Kategorie-Schätzung':basis==='similar'?'Schätzung aus ähnlichen Produkten':anchor.sourceLabel;
      const otherBrands=[...new Set(selected.map(row=>row.ref.brand).filter(brand=>norm(brand)!==norm(product.brand)))];
      const brandNote=product.brand&&basis!=='exact'&&otherBrands.length?
        `Markenabweichung: Preisbeispiel${selected.length===1?'':'e'} von ${otherBrands.filter(Boolean).join(', ')||'nicht angegebener Marke'} statt ${product.brand}; der Preis der gewählten Marke ist nicht belegt.`:'';
      const discardedVolume=product.pack?.unit==='ml'&&dryPackFamilies.has(family(product.title,product.category,product.brand));
      const preparationNote=discardedVolume?`Die erfassten ${product.pack.min}${product.pack.max!==product.pack.min?'–'+product.pack.max:''} ml bezeichnen die Zubereitung. Das Beutelgewicht ist unbekannt; gerechnet wird mit der angegebenen Referenzpackung.`:'';
      const assumptionNote=[brandNote,preparationNote].filter(Boolean).join(' ');
      const explanation=[basis==='exact'?'Gerundetes Budget aus dem datierten Preisbeispiel dieses Produkts.':
        basis==='similar'?`Budget aus ${selected.length} ähnlichen Preisbeispiel${selected.length===1?'':'en'}; kein Preisnachweis für dieses Produkt.`:
        `Grobes Budget aus dem Median von ${selected.length} Preisbeispielen der Kategorie „${product.category}“; Produkt und Sorte können abweichen.`,
        !given?`${discardedVolume?'Originalpackung nicht bestimmt':'Packungsgröße fehlt'}: angenommen ${size} ${pack.unit} anhand der Referenzen.`:'',
        assumedRange?`Ein Größenbereich wird mit seiner Mitte gerechnet${given&&given.min!==given.max?` (${given.min}–${given.max} ${pack.unit})`:''}.`:'',
        assumptionNote,
        ...new Set(selected.map(row=>row.ref.note).filter(Boolean)),
        'Kein bestätigter Preis eines ausgewählten Händlers.'].filter(Boolean).join(' ');
      return {id:anchor.id,label:anchor.label,brand:anchor.brand,category:product.category||anchor.category,
        pack,cents,total:cents,qty:1,referenceCents:anchor.cents,referencePack:anchor.pack,
        sourceUrl:anchor.sourceUrl,sourceLabel,reviewedAt:dates[0],reviewDue:due[0],
        assumedPack:!given,assumedRange,scaled:size!==middle(anchor.pack),stale:due.some(date=>today>=date),
        basis,referenceCount:selected.length,explanation,...(assumptionNote?{assumptionNote}:{}),
        ...(basis!=='exact'||assumedRange?{rangeLow:rounded(Math.min(...rangeValues)),rangeHigh:rounded(Math.max(...rangeValues))}:{} )};
    }
    function estimate(product,qty=1,today=reviewedAt){
      if(!Number.isInteger(qty)||qty<1||qty>99)return null;
      // Cache the base estimate, not the current catalog replacement: an old saved
      // shopping-list snapshot can carry a different pack or special diet.
      const key=JSON.stringify([product?.id,product?.title,product?.brand,product?.line,product?.category,product?.pack,product?.dietaryLabels,
        product?.bio,product?.vegan,product?.vegetarian,product?.lactoseFree,product?.glutenFree,product?.isGroupChoice,product?.groupSelection,product?.groupId,product?.variantId,today]);
      if(!cache.has(key)){if(cache.size>=10000)cache.clear();cache.set(key,calculate(product,today));}
      const result=cache.get(key).value;
      return result?{...result,pack:{...result.pack},referencePack:{...result.referencePack},qty,total:result.cents*qty}:null;
    }
    function coverage(today=reviewedAt){
      if(coverageCache.has(today)){
        const saved=coverageCache.get(today);
        return {...saved,missingReasons:{...saved.missingReasons},unestimated:saved.unestimated.map(row=>({...row}))};
      }
      const report={total:catalog.size,estimated:0,exact:0,similar:0,category:0,missing:0,missingReasons:{},unestimated:[]};
      for(const product of catalog.values()){
        const result=estimate(product,1,today);
        if(result){report.estimated++;report[result.basis]++;continue;}
        const reason=calculate(product,today).reason||'Keine verwendbare Preisreferenz';
        report.missing++;report.missingReasons[reason]=(report.missingReasons[reason]||0)+1;
        report.unestimated.push({id:product.id,title:product.title,reason});
      }
      if(coverageCache.size>=10)coverageCache.clear();
      coverageCache.set(today,report);
      return {...report,missingReasons:{...report.missingReasons},unestimated:report.unestimated.map(row=>({...row}))};
    }
    return {estimate,summarize:(unknown,today)=>collectSummary(unknown,today,estimate),entries:[...entries,...prepared.map(row=>row.ref)],coverage};
  }
  let defaultEstimator;
  const getDefault=()=>defaultEstimator||(defaultEstimator=createEstimator([]));
  return {entries,reviewedAt,reviewDue,estimate:(...args)=>getDefault().estimate(...args),summarize:(...args)=>getDefault().summarize(...args),createEstimator};
});
