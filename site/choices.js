/* Opt-in product substitutions. Prices, validity and retailer eligibility stay in engine.js. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparnahChoices = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ß/g, 'ss').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  const packKey = pack => pack && Number.isFinite(pack.min) && pack.min > 0 && pack.min === pack.max && ['g', 'ml', 'St', 'St.', 'Blatt'].includes(pack.unit) ? `${pack.min}${pack.unit}` : null;
  const packLabel = pack => `${new Intl.NumberFormat('de-DE').format(pack.min)} ${pack.unit}`;
  const key = value => encodeURIComponent(value);
  const productText = product => normalize([product.title, product.line, ...(Array.isArray(product.dietaryLabels) ? product.dietaryLabels : [])].filter(Boolean).join(' '));
  function dietaryKey(product) {
    const t = productText(product);
    return [
      /\bbio\b|\borganic\b/.test(t) || product.bio === true ? 'bio' : 'ordinary',
      /\bvegan\w*\b/.test(t) || product.vegan === true ? 'vegan' : /\bvegetar\w*\b/.test(t) || product.vegetarian === true ? 'vegetarian' : 'unspecified',
      /\blakto[sz]efrei\w*\b|\bohne lakto[sz]e\b/.test(t) || product.lactoseFree === true ? 'lactose-free' : 'ordinary',
      /\bglutenfrei\w*\b|\bohne gluten\b/.test(t) || product.glutenFree === true ? 'gluten-free' : 'ordinary',
      /\bzuckerfrei\w*\b|\bohne zucker\b/.test(t) ? 'sugar-free' : 'ordinary'
    ].join(':');
  }
  function knownBrands(products) {
    return [...new Set((products || []).map(p => normalize(p.brand)).filter(Boolean))].sort((a, b) => b.length - a.length);
  }
  function brandOf(product, brands) {
    const title = normalize(product.title), named = normalize(product.brand);
    if (named) return named === 'nutella' ? 'ferrero' : named;
    if (/^(?:ferrero )?nutella(?:\s|$)/.test(title)) return 'ferrero';
    return brands.find(brand => title === brand || title.startsWith(brand + ' ')) || '';
  }
  function withoutPack(title) { return title.replace(/\b(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|stuck|st\.?)(?=\s|$|[,;])/g, '').replace(/\s+/g, ' ').trim(); }
  function withoutBrand(product, brands) {
    let title = withoutPack(normalize(product.title));
    const brand = brandOf(product, brands);
    if (brand && title.startsWith(brand + ' ')) title = title.slice(brand.length + 1);
    return title;
  }
  function butterProfile(product, brands) {
    if (!packKey(product.pack) || product.pack.unit !== 'g') return null;
    const title = withoutBrand(product, brands);
    // A named butter option in a mixed promotion is valid; spread by itself is not butter.
    const plain = title.replace(/ (?:oder|\/) (?:die )?streichzart(?:e)?$/, '').replace(/\b(marken|sussrahm|sauerrahm)butter\b/g, '$1 butter');
    if (!/^(?:(?:feine|original|irische|deutsche|marken|mildgesauerte|sus[sz]rahm|sauerrahm|bio|ungesalzene?|gesalzene?|lakto[sz]efreie?)\s+)*butter$/.test(plain)) return null;
    const t = productText(product);
    if (/\bvegan\w*\b|\bvegetar\w*\b|\bhalbfett\b|\breduziert\b/.test(t)) return null;
    const salted = /\bgesalzen\w*\b/.test(t) ? 'salted' : 'unsalted';
    const style = /sussrahm/.test(t) ? 'sweet' : /sauerrahm/.test(t) ? 'sour' : /mildgesauert/.test(t) ? 'mild' : 'any';
    return { kind: 'butter', style, group: `choice:butter:${packKey(product.pack)}:${salted}:${style}:${dietaryKey(product)}`, description: `Butter verschiedener Marken · ${packLabel(product.pack)}${salted === 'salted' ? ' · gesalzen' : ''}. Besondere Ernährungsangaben bleiben erhalten.` };
  }
  function milkProfiles(product, brands) {
    if (!packKey(product.pack) || product.pack.unit !== 'ml') return [];
    const title = withoutBrand(product, brands);
    if (!/(?:^|[ -])(?:vollmilch|weidemilch|ziegenmilch|schafmilch|milch)\b/.test(title) || /kakao|shake|barista|kokos|mandel|hafer|soja|reis|schoko|buttermilch|kondens|kaffee/.test(title)) return [];
    const fatMatch = title.match(/(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*)\s*%/);
    if (!fatMatch) return [];
    const rest = title.replace(fatMatch[0], '').replace(/\b(?:vollmilch|weidemilch|ziegenmilch|schafmilch|milch|fett|bio|h|esl|fettarm\w*|frisch\w*|haltbar\w*|lakto[sz]efrei\w*)\b/g, '').replace(/[\s-]+/g, '');
    if (rest) return []; // Flavoured or otherwise unspecified milk is not ordinary drinking milk.
    const fats = [...new Set(fatMatch[1].split('/').map(x => Number(x.trim().replace(',', '.'))))];
    if (fats.some(x => x < 0 || x > 10)) return [];
    const species = /ziegen/.test(title) ? 'goat' : /schaf/.test(title) ? 'sheep' : 'cow';
    const processing = /\bhaltbar\w*|\bh-/.test(title) ? 'long-life' : /\bfrisch\w*/.test(title) ? 'fresh' : 'any';
    if (/\bhaltbar\w*|\bh-/.test(title) && /\bfrisch\w*/.test(title)) return [];
    const grazing = /\bweide\w*/.test(title) ? 'pasture' : 'any';
    return fats.map(fat => ({kind: 'milk', fat, processing, grazing,
      group: `choice:milk:${species}:${fat}:${processing}:${grazing}:${packKey(product.pack)}:${dietaryKey(product)}`,
      description: `Milch verschiedener Marken · ${String(fat).replace('.', ',')} % Fett · ${packLabel(product.pack)}${processing === 'fresh' ? ' · frisch' : processing === 'long-life' ? ' · haltbar' : ''}${grazing === 'pasture' ? ' · Weidemilch' : ''}. Bio- und Laktoseangaben bleiben erhalten.`
    }));
  }
  function frostaProfile(product, brands) {
    if (!packKey(product.pack) || product.pack.unit !== 'g' || !/\bfrosta\b/.test(normalize(product.brand) + ' ' + normalize(product.title))) return null;
    const line = normalize(product.line), group = normalize(product.groupId), title = normalize(product.title);
    const map = { 'standard': 'standard', 'xxl': 'xxl', 'kleine gerichte': 'small', 'high protein': 'high-protein', 'a la carte': 'premium', 'premium': 'premium', 'asian style': 'asian', 'street food': 'asian', 'vegan': 'vegan', 'bio': 'bio' };
    let family = map[line];
    const namedFamilies = [/high protein/.test(title) ? 'high-protein' : null, /a la carte|premium/.test(title) ? 'premium' : null, /asian style|street food/.test(title) ? 'asian' : null].filter(Boolean);
    if (namedFamilies.length > 1 || family && namedFamilies.length === 1 && family !== namedFamilies[0]) return null;
    if (!family) {
      if (group === 'frosta-meals') family = 'standard';
      else if (group.startsWith('frosta-family:') || group.startsWith('frosta-line:')) family = map[group.slice(group.indexOf(':') + 1).replace(/-/g, ' ')] || group.slice(group.indexOf(':') + 1);
      else if (/\bfertiggerichte?\b|\bgerichte?\b/.test(title)) {
        if (namedFamilies.length === 1) family = namedFamilies[0];
      }
    }
    if (!family || !['standard', 'xxl', 'small', 'high-protein', 'premium', 'asian', 'vegan', 'bio'].includes(family)) return null;
    return {kind: 'frosta', group: `choice:frosta:${family}:${packKey(product.pack)}:${dietaryKey(product)}`, description: `Günstigste FRoSTA-Sorte derselben Produktlinie · ${packLabel(product.pack)}. Bio-, Vegan- und weitere Ernährungsangaben bleiben erhalten.`};
  }
  function sameProductProfile(product, brands) {
    const brand = brandOf(product, brands), title = withoutBrand(product, brands);
    if (product.groupSelection || product.isGroupChoice || !brand || !title || !packKey(product.pack) || /\b(?:oder|verschiedene|versch)\b|\//.test(title)) return null;
    return {kind: 'same-product', group: `choice:same:${key(brand)}:${key(title)}:${packKey(product.pack)}:${dietaryKey(product)}`, description: `Günstigster erfasster Preis derselben Marke und Produktausführung · ${packLabel(product.pack)}.`};
  }
  const householdCategory = 'Haushalt & Drogerie';
  const householdTitle = (product, brands) => {
    let title = normalize(product.title), brand = brandOf(product, brands);
    if (brand && title.startsWith(brand + ' ')) title = title.slice(brand.length + 1);
    // Litres describe bin capacity, not how many bags are inside the package.
    title = product.pack?.unit === 'St.' ? title.replace(/\b\d+\s*(?:stuck|st\.?)(?=\s|$|[,;])/g, '') : withoutPack(title);
    return title.replace(/[‐‑–—-]/g, ' ').replace(/\s+/g, ' ').trim();
  };
  function paperProfile(product, brands) {
    if (product.pack.unit !== 'Blatt') return null;
    const title = householdTitle(product, brands);
    const type = /\b(?:toilettenpapier|klopapier)\b/.test(title) ? 'toilet-paper' : /\b(?:kuchenpapier|kuchenrollen|kuchentucher)\b/.test(title) ? 'kitchen-paper' : null;
    if (!type) return null;
    const text = normalize([product.title, product.subtitle].filter(Boolean).join(' '));
    const namedLayers = Number(text.match(/\b([2-5])\s*-?\s*lagig\b/)?.[1]);
    const layers = Number(product.paperLayers || namedLayers);
    const rollCount = text.match(/\b(\d+)\s*(?:rollen\s*(?:mit|a|à|je)?\s*)?[x×]\s*(\d+)\s*blatt\b/);
    const statedTotal = text.match(/\b(?:insgesamt|gesamt)\s*(\d+)\s*blatt\b/) || text.match(/\b(\d+)\s*blatt\s*(?:insgesamt|gesamt)\b/);
    const total = Number(product.paperTotalSheets || (rollCount ? Number(rollCount[1]) * Number(rollCount[2]) : statedTotal?.[1]));
    // A bare "150 Blatt" usually describes a roll. It is not a verified pack total.
    if (![2,3,4,5].includes(layers) || !Number.isSafeInteger(total) || total !== product.pack.min) return null;
    if (namedLayers && namedLayers !== layers || rollCount && Number(rollCount[1])*Number(rollCount[2]) !== total || statedTotal && Number(statedTotal[1]) !== total) return null;
    const remainder = title.replace(/\b(?:toilettenpapier|klopapier|kuchenpapier|kuchenrollen|kuchentucher)\b/g, '')
      .replace(/\b[2-5]\s*lagig\b/g, '').replace(/\b\d+\s*(?:rollen\s*(?:mit|a|à|je)?\s*)?[x×]\s*\d+\s*blatt\b/g, '')
      .replace(/\b(?:insgesamt|gesamt)\s*\d+\s*blatt\b|\b\d+\s*blatt\s*(?:insgesamt|gesamt)\b/g, '')
      .replace(/\b(?:xxl|classic|klassik|recycling)\b/g, '').replace(/\s+/g, '');
    if (remainder) return null;
    const recycling = /\brecycling\b/.test(title) || product.recycled === true ? 'recycled' : 'unspecified';
    return {kind:'household',group:`choice:household:${type}:${layers}-ply:${recycling}:${packKey(product.pack)}`,
      description:`Marke egal · ${layers}-lagig · insgesamt ${packLabel(product.pack)}. Verglichen werden nur Packungen mit bestätigter Gesamtblattzahl und gleicher Lagenzahl.`};
  }
  function householdProfile(product, brands) {
    const paper = paperProfile(product, brands);
    if (paper) return paper;
    const title = householdTitle(product, brands), unit = product.pack.unit;
    const rules = [
      ['ml', /^(?:glasreiniger|glas reiniger) (?:spray|spruhflasche)$/, ()=>'glass-cleaner:spray'],
      ['ml', /^(?:glasreiniger|glas reiniger) (?:nachfullpack|nachfullpackung|nachfullbeutel)$/, ()=>'glass-cleaner:refill'],
      ['ml', /^(?:allzweckreiniger|allzweck reiniger) (?:spray|spruhflasche)$/, ()=>'all-purpose-cleaner:spray'],
      ['ml', /^(?:handspulmittel|geschirrspulmittel|spulmittel)(?: flussig)?$/, ()=>'hand-dishwashing-liquid:ordinary'],
      ['ml', /^(?:flussigseife|handseife flussig) (?:nachfullpack|nachfullpackung|nachfullbeutel)$/, ()=>'liquid-hand-soap:refill'],
      ['St.', /^mullbeutel (\d+)\s*(?:l|liter)$/, m=>'bin-bags:'+m[1]+'-litre'],
      ['St.', /^backpapier zuschnitte (\d+)\s*[x×]\s*(\d+)\s*cm$/, m=>'baking-paper:sheets:'+m[1]+'x'+m[2]+'cm'],
      ['St.', /^spulschwamme$/, ()=>'dishwashing-sponges:ordinary'],
      ['St.', /^(?:spulmaschinentabs|geschirrspultabs) (?:classic|klassik)$/, ()=>'dishwasher-tabs:classic'],
      ['g', /^(?:spulmaschinensalz|geschirrspulsalz)$/, ()=>'dishwasher-salt']
    ];
    for (const [required,pattern,family] of rules) {
      if (unit !== required) continue;
      const match = title.match(pattern);
      if (match) return {kind:'household',group:`choice:household:${family(match)}:${packKey(product.pack)}`,
        description:`Marke egal · ${packLabel(product.pack)}. Nur dieselbe Produktart und Verpackungsform mit gleicher Packungsgröße werden verglichen; Konzentrate und andere Ausführungen bleiben getrennt.`};
    }
    return null;
  }
  const manufacturerDefinitions = [
    ['glass-spiritus-spray','Glas-Reiniger Spiritus',500,'Sprühflasche','glas-reiniger-spiritus','frosch-de_frosch_spiritus_glas-reiniger_500mll_565y642py_productdashboardmq1.png',['Spiritus Glas-Reiniger','Glasreiniger Spiritus']],
    ['glass-spiritus-refill','Glas-Reiniger Spiritus Nachfüllbeutel',950,'Nachfüllbeutel','glas-reiniger-spiritus-nachfuellbeutel','frosch-de_frosch-spiritus-glas-reiniger-nfb-950ml_565y642py_productdashboardmq1.png',['Spiritus Glas-Reiniger Nachfüllbeutel','Glasreiniger Spiritus Nachfüllbeutel']],
    ['all-purpose-soda-spray','Allzweck-Reiniger Soda',500,'Spray','allzweck-reiniger-soda','frosch-de_frosch_soda_allzweck-reiniger_500ml_565y642py_productdashboardmq1.png',['Soda Allzweck-Reiniger','Allzweckreiniger Soda']],
    ['vinegar-cleaner','Essig Reiniger',1000,'Flasche','essig-reiniger','frosch-de_frosch_essig-reiniger_1l_565y642py_productdashboardmq1-2.png',['Essigreiniger']],
    ['neutral-cleaner','Neutral Reiniger',1000,'Flasche','neutral-reiniger','frosch_all_purpose_cleaner_neutral_1000ml_d_productdashboardmq1.png',['Neutralreiniger']]
  ];
  function manufacturerDefinition(product, brands) {
    if (brandOf(product, brands) !== 'frosch' || product.pack.unit !== 'ml') return null;
    const statedSizes=[...normalize(product.title).matchAll(/\b(\d+(?:[.,]\d+)?)\s*(ml|l)\b/g)];
    if (statedSizes.some(m=>Number(m[1].replace(',','.'))*(m[2]==='l'?1000:1)!==product.pack.min)) return null;
    const title = householdTitle(product, brands);
    return manufacturerDefinitions.find(([,name,amount,form,,,aliases]) =>
      product.pack.min === amount && (!product.productForm || normalize(product.productForm) === normalize(form)) &&
      (!product.line || normalize(name).includes(normalize(product.line))) &&
      [name,...aliases].some(alias => householdTitle({title:alias,brand:''},[]) === title)) || null;
  }
  function manufacturerProfile(product, brands) {
    const definition = manufacturerDefinition(product, brands);
    return definition ? {kind:'same-product',group:'choice:manufacturer:frosch:'+definition[0],
      description:`Günstigster erfasster Preis derselben Frosch-Ausführung · ${definition[3]} · ${packLabel(product.pack)}. Andere Reiniger und Nachfüllformate bleiben getrennt.`} : null;
  }
  function referenceProducts() {
    return manufacturerDefinitions.map(([id,title,size,form,slug,image,aliases]) => {
      const productId='manufacturer:frosch:'+id;
      return {id:productId,title:'Frosch '+title,brand:'Frosch',variantId:productId,
        groupId:'choice:manufacturer:frosch:'+id,pack:{min:size,max:size,unit:'ml'},category:householdCategory,
        productForm:form,referenceWish:true,emoji:'🧽',aliases:aliases.map(alias=>'Frosch '+alias),subtitle:`${form} · ${packLabel({min:size,unit:'ml'})}`,
        manufacturerSourceUrl:`https://frosch.de/de/produkte-und-tipps/${slug}.html`,manufacturerCheckedAt:'2026-10-20',
        image:`https://frosch.de/produktdatenbank/produktbilder/${image}`,imagePack:{min:size,max:size,unit:'ml'},
        selectionHint:'Herstellerreferenz; Angebotspreis und Verfügbarkeit beim ausgewählten Händler sind noch offen.'};
    });
  }
  function juiceProfile(title, product) {
    if (product.pack.unit !== 'ml') return null;
    const plain = title.replace(/^bio /, '');
    const fruit = plain.match(/\b(apfelsaft|orangensaft|traubensaft)\b/);
    if (!fruit) return null;
    const rest = plain.replace(fruit[0], '').replace(/\b100\s*%/g, '').trim();
    const concentratePattern = new RegExp(`\\baus (?:${fruit[1]})?konzentrat\\b`,'g');
    const direct = /\bdirektsaft\b/.test(rest), concentrate = new RegExp(concentratePattern.source).test(rest);
    const cloudy = /\bnaturtrub(?:e[rmns]?)?\b/.test(rest), clear = /\bklar(?:e[rmns]?)?\b/.test(rest);
    if (direct && concentrate || cloudy && clear) return null;
    // All text must describe pure juice. Nectar, spritzers, mixes, light drinks,
    // flavours and unidentified qualifications must never acquire a juice group.
    const remainder = rest.replace(/\bdirektsaft\b/g, '').replace(concentratePattern, '')
      .replace(/\b(?:naturtrub|klar)(?:e[rmns]?)?\b/g, '').replace(/\s+/g, '');
    if (remainder) return null;
    const clarity = cloudy?'naturtrub':clear?'klar':null, processing = direct?'direktsaft':concentrate?'aus konzentrat':null;
    // Retain earlier one-qualifier group keys for already saved choices.
    const style = product.juiceStyleAny === true ? 'any' : [clarity,processing].filter(Boolean).join(':') || 'unspecified';
    return {fruit:fruit[1],style};
  }
  function alternativeProfile(product, brands) {
    if (!packKey(product.pack) || !['g','ml'].includes(product.pack.unit)) return null;
    const title = withoutBrand(product, brands).replace(/(\d),(\d)/g,'$1.$2').replace(/[,-]+/g,' ').replace(/\s+/g,' ').trim();
    if (/\b(?:oder|verschiedene|sortiment)\b|\//.test(title)) return null;
    let family=null,label=null;
    const juice = juiceProfile(title, product);
    if (juice) { family=`juice:${juice.fruit}:${juice.style}`;label=juice.fruit; }
    // Only the spread itself: the brand also sells biscuits, ice cream and snacks.
    if (/^(?:ferrero )?nutella(?: classic| klassisch)?$/.test(title) || /^(?:bio )?(?:nuss nougat ?creme|nuss nugat ?creme|haselnuss nougat ?creme)$/.test(title)) {
      family='hazelnut-cocoa-spread';label='Nuss-Nougat-Creme';
    }
    // Explicit product types, not a shared department or marketing keyword.
    const pasta=title.match(/^(?:bio )?(?:hartweizen )?(spaghetti|spaghettini|penne(?: rigate)?|fusilli|farfalle|rigatoni)$/);
    const rice=title.match(/^(?:bio )?(basmati(?:reis| reis)|jasmin(?:reis| reis)|parboiled reis|langkornreis|vollkornreis)$/);
    if(pasta){family='pasta:'+pasta[1];label=pasta[1];}
    if(rice){family='rice:'+rice[1].replace(/ /g,'');label=rice[1];}
    // Full-title rules prevent ingredients and prepared meals from matching a staple.
    // Unknown qualifiers remain unmatched instead of being silently discarded.
    const plain=title.replace(/^bio /,'');
    const rules=product.pack.unit==='g'?[
      [/^(?:qualitats )?(weizenmehl|dinkelmehl|roggenmehl) (?:type ?)?(\d{3,4})$/, m=>'flour:'+m[1]+':'+m[2]],
      [/^(weizen|dinkel|roggen)(?:vollkornmehl|mehl vollkorn)$/, m=>'flour:'+m[1]+':wholegrain'],
      [/^(puderzucker|wurfelzucker|kristallzucker|raffinade|feinster zucker)$/, m=>'sugar:'+(/raffinade|feinster/.test(m[1])?'kristallzucker':m[1])],
      [/^(?:haferflocken (zart|kernig|feinblatt|grossblatt)|(zarte|kernige) haferflocken)$/, m=>'oats:'+(/zart|feinblatt/.test(m[1]||m[2])?'fine':'coarse')],
      [/^(?:passierte tomaten|tomaten passiert|passata(?: di pomodoro)?)$/, ()=>'tomatoes:strained'],
      [/^(?:gehackte tomaten|tomaten gehackt|stuckige tomaten|tomatenstucke)$/, ()=>'tomatoes:chopped'],
      [/^(?:joghurt )?(\d+(?:\.\d+)?)\s*% fett (?:milder )?naturjoghurt$|^(?:milder )?naturjoghurt (\d+(?:\.\d+)?)\s*%(?: fett)?$/, m=>'yogurt:natural:'+Number(m[1]||m[2])],
      [/^(speisequark|magerquark|skyr natur|butterschmalz|speisestarke|backpulver|tomatenmark|rote linsen|braune linsen|kichererbsen getrocknet|bulgur|couscous)$/, m=>'staple:'+m[1]],
      [/^(speisequark) (\d+)\s*% fett i\.\s*tr\.?$/, m=>'quark:'+m[2]],
      [/^(?:gemahlener kaffee|kaffee gemahlen|filterkaffee|mahlkaffee)(?: (mild|intenso|entkoffeiniert))?$/, m=>'coffee:ground:'+(m[1]||'ordinary')],
      [/^(?:kaffeebohnen|kaffee ganze bohne|ganze bohne)(?: (espresso|crema|entkoffeiniert))?$/, m=>'coffee:beans:'+(m[1]||'ordinary')],
    ]:[
      [/^tomaten ?ketchup$/, ()=>'ketchup:tomato'],
      [/^(sonnenblumenol|rapsol|olivenol)(?: (nativ extra|nativ|kaltgepresst|raffiniert))?$/, m=>'oil:'+m[1]+':'+(m[2]||'unspecified')],
      [/^(?:naturliches )?mineralwasser (classic|klassik|medium|naturell|still)$/, m=>'water:'+({classic:'sparkling',klassik:'sparkling',naturell:'still'}[m[1]]||m[1])],
      [/^(haferdrink|sojadrink|mandeldrink)(?: (natur|ungesusst|ohne zucker|barista))?$/, m=>'plantdrink:'+m[1]+':'+(m[2]||'unspecified')],
      [/^(apfelessig|weissweinessig|rotweinessig)$/, m=>'vinegar:'+m[1]],
    ];
    for(const [pattern,identify] of rules){const m=plain.match(pattern);if(m){family=identify(m);label=plain;break;}}
    // Identical concrete food descriptions also work across brands, retaining all
    // qualifiers. Generic marketing names (Classic, Gold, etc.) never form a group.
    if(!family && /^(?:erdnussbutter|erdnussmus|mandelmus|erdbeerkonfiture|aprikosenkonfiture|honig|gouda|emmentaler|mozzarella|feta|frischkase|tiefkuhl erbsen|tiefkuhl blattspinat)(?: (?:natur|cremig|stuckig|mild|gerieben|in scheiben|doppelrahmstufe))*$/.test(plain) && product.pack.unit==='g'){
      family='food:'+plain;label=plain;
    }
    // The entire remaining food description is the key, including cultivar,
    // flavour and preparation. This general rule is not tied to a named brand.
    if(!family && product.pack.unit==='g' && /\b(?:apfel|tafelapfel|bananen|birnen|kartoffeln|karotten|mohren|zwiebeln|paprika|gurken|zucchini|brokkoli|blumenkohl|champignons|erdbeeren|himbeeren|heidelbeeren|walnusskerne|mandeln|cashewkerne|sonnenblumenkerne|rosinen|sultaninen|kidneybohnen|kichererbsen|linsen|erbsen|blattspinat|rahmspinat|pommes frites|gouda|emmentaler|mozzarella|feta|frischkase|cottage cheese|kochschinken|hahnchenbrustfilet|putenbrustfilet|schweineschnitzel|rinderhackfleisch|schweinehackfleisch|lachsfilet|seelachsfilet|fischstabchen|pizza salami|pizza margherita|pizzateig|blatterteig|toastbrot|vollkorntoast|knackebrot|zwieback|honig|erdbeerkonfiture|aprikosenkonfiture|erdnussbutter|erdnussmus|mandelmus)\b/.test(plain) && !/\b(?:sorten|gemischt|mischung)\b/.test(plain)){
      family='description:'+plain;label=plain;
    }
    if(family && /^(?:hazelnut|pasta:|rice:)/.test(family) && product.pack.unit!=='g')return null;
    if(!family)return null;
    const basis=product.pack.unit==='ml'?'Literpreis':'Kilopreis';
    return {kind:'alternative',...(juice?{juice}:{}),group:`choice:alternative:${family}:${product.pack.unit}:${dietaryKey(product)}`,description:`${label} verschiedener Marken, einschließlich Eigenmarken: günstigster ${basis}. Ähnliche Packungen (bis zu 20 % kleiner oder größer als ${packLabel(product.pack)}), gleiche Anzahl Packungen. Tatsächliche Größe, ${basis} und Kassenbetrag werden angezeigt; besondere Ernährungsangaben bleiben erhalten.`};
  }
  function profiles(product, brands) {
    if (!product || product.packUnconfirmed || !packKey(product.pack)) return [];
    const manufacturer = manufacturerProfile(product, brands);
    if (manufacturer) return [manufacturer];
    const household = householdProfile(product, brands);
    if (household) return [household];
    const butter = butterProfile(product, brands);
    if (butter) return [butter];
    const milk = milkProfiles(product, brands);
    if (milk.length) return milk;
    const frosta = frostaProfile(product, brands);
    if (frosta) return [frosta];
    const alternative = alternativeProfile(product, brands);
    if (alternative) return [alternative];
    const same = sameProductProfile(product, brands);
    return same ? [same] : [];
  }
  function profileGroups(product, brands) { return profiles(product, brands).flatMap(profile => {
        if (profile.kind === 'butter' && profile.style !== 'any') return [profile.group, profile.group.replace(`:${profile.style}:`, ':any:')];
        if (profile.juice && profile.juice.style !== 'any') return [profile.group, `choice:alternative:juice:${profile.juice.fruit}:any:ml:${dietaryKey(product)}`];
        if (profile.kind !== 'milk') return [profile.group];
        // Unspecified milk processing/pasture wishes may also use a more specific matching milk.
        const groups = [profile.group];
        if (profile.processing !== 'any') groups.push(profile.group.replace(`:${profile.processing}:`, ':any:'));
        if (profile.grazing !== 'any') for (const group of [...groups]) groups.push(group.replace(':pasture:', ':any:'));
        return groups;
      }); }
  function basicWishes(products = []) {
    const brands = knownBrands(products);
    // These are shopping wishes with explicit sizes, never price or stock claims.
    // IDs and order depend on product meaning, not changing retailer catalogues.
    const definitions = [
      ['butter','Butter',250,'g','Milchprodukte & Kühlung','🧈'],
      ['milk-15','Milch 1,5 % Fett',1000,'ml','Milchprodukte & Kühlung','🥛'],
      ['milk-35','Milch 3,5 % Fett',1000,'ml','Milchprodukte & Kühlung','🥛'],
      ['flour-wheat-405','Weizenmehl Type 405',1000,'g','Vorrat & Grundnahrungsmittel','🥫'],
      ['flour-wheat-550','Weizenmehl Type 550',1000,'g','Vorrat & Grundnahrungsmittel','🥫'],
      ['flour-wheat-1050','Weizenmehl Type 1050',1000,'g','Vorrat & Grundnahrungsmittel','🥫'],
      ['flour-spelt-630','Dinkelmehl Type 630',1000,'g','Vorrat & Grundnahrungsmittel','🥫'],
      ['flour-rye-1150','Roggenmehl Type 1150',1000,'g','Vorrat & Grundnahrungsmittel','🥫'],
      ['sugar-crystal','Kristallzucker',1000,'g','Vorrat & Grundnahrungsmittel','🥫'],
      ['sugar-powder','Puderzucker',250,'g','Vorrat & Grundnahrungsmittel','🥫'],
      ['oats-fine','Haferflocken zart',500,'g','Vorrat & Grundnahrungsmittel','🥣'],
      ['oats-coarse','Haferflocken kernig',500,'g','Vorrat & Grundnahrungsmittel','🥣'],
      ['yogurt-15','Naturjoghurt 1,5 % Fett',500,'g','Milchprodukte & Kühlung','🥛'],
      ['yogurt-35','Naturjoghurt 3,5 % Fett',500,'g','Milchprodukte & Kühlung','🥛'],
      ['quark-lean','Magerquark',500,'g','Milchprodukte & Kühlung','🥛'],
      ['quark-20','Speisequark 20 % Fett i. Tr.',500,'g','Milchprodukte & Kühlung','🥛'],
      ['quark-40','Speisequark 40 % Fett i. Tr.',500,'g','Milchprodukte & Kühlung','🥛'],
      ['skyr-natural','Skyr natur',500,'g','Milchprodukte & Kühlung','🥛'],
      ['pasta-spaghetti','Spaghetti',500,'g','Vorrat & Grundnahrungsmittel','🍝'],
      ['pasta-penne','Penne',500,'g','Vorrat & Grundnahrungsmittel','🍝'],
      ['pasta-fusilli','Fusilli',500,'g','Vorrat & Grundnahrungsmittel','🍝'],
      ['pasta-farfalle','Farfalle',500,'g','Vorrat & Grundnahrungsmittel','🍝'],
      ['rice-basmati','Basmati Reis',1000,'g','Vorrat & Grundnahrungsmittel','🍚'],
      ['rice-jasmine','Jasmin Reis',1000,'g','Vorrat & Grundnahrungsmittel','🍚'],
      ['rice-parboiled','Parboiled Reis',1000,'g','Vorrat & Grundnahrungsmittel','🍚'],
      ['rice-wholegrain','Vollkornreis',1000,'g','Vorrat & Grundnahrungsmittel','🍚'],
      ['oil-rapeseed','Rapsöl',1000,'ml','Vorrat & Grundnahrungsmittel','🫒'],
      ['oil-sunflower','Sonnenblumenöl',1000,'ml','Vorrat & Grundnahrungsmittel','🫒'],
      ['oil-olive-extra','Olivenöl nativ extra',500,'ml','Vorrat & Grundnahrungsmittel','🫒'],
      ['juice-apple','Apfelsaft',1000,'ml','Getränke','🧃',true],
      ['juice-orange','Orangensaft',1000,'ml','Getränke','🧃',true],
      ['juice-grape','Traubensaft',1000,'ml','Getränke','🧃',true],
      ['water-still','Mineralwasser still',1500,'ml','Getränke','💧'],
      ['water-medium','Mineralwasser medium',1500,'ml','Getränke','💧'],
      ['water-sparkling','Mineralwasser classic',1500,'ml','Getränke','💧'],
      ['tomatoes-strained','Passierte Tomaten',500,'g','Vorrat & Grundnahrungsmittel','🥫'],
      ['tomatoes-chopped','Gehackte Tomaten',400,'g','Vorrat & Grundnahrungsmittel','🥫'],
      ['tomato-paste','Tomatenmark',200,'g','Vorrat & Grundnahrungsmittel','🥫'],
      ['lentils-red','Rote Linsen',500,'g','Vorrat & Grundnahrungsmittel','🥫'],
      ['coffee-ground','Kaffee gemahlen',500,'g','Vorrat & Grundnahrungsmittel','☕']
    ];
    const existing = new Set();
    for (const p of products) {
      if (!p || p.brand || p.variantId || !packKey(p.pack)) continue;
      // Only suppress a wish when the retained product can actually use the
      // profile groups annotated on offers (or an explicitly supported legacy group).
      for (const profile of profiles(p,brands)) {
        if (p.groupId === profile.group || ['butter','milch-35'].includes(p.groupId)) existing.add(`${profile.group}|${packKey(p.pack)}`);
      }
      if (p.groupId) existing.add(`${p.groupId}|${packKey(p.pack)}`);
    }
    return definitions.flatMap(([id,title,size,unit,category,emoji,juiceStyleAny])=>{
      const p={id:'basic:'+id,title,brand:'',variantId:null,isGroupChoice:true,pack:{min:size,max:size,unit},category,emoji,
        ...(juiceStyleAny?{juiceStyleAny:true}:{}),subtitle:`Marke egal · ${juiceStyleAny?'Art egal · ':''}${packLabel({min:size,unit})}`};
      const profile=profiles(p,brands)[0];
      if (!profile || existing.has(`${profile.group}|${packKey(p.pack)}`)) return [];
      return [{...p,groupId:profile.group}];
    });
  }
  function householdWishes(products = []) {
    const brands=knownBrands(products);
    const definitions=[
      ['toilet-paper-3ply','Toilettenpapier 3-lagig',1200,'Blatt','🧻',{paperLayers:3,paperTotalSheets:1200,aliases:['Klopapier','Toilettenpapier Marke egal']}],
      ['kitchen-paper-3ply','Küchenpapier 3-lagig',256,'Blatt','🧻',{paperLayers:3,paperTotalSheets:256,aliases:['Küchenrolle','Küchenrollen','Küchentücher']}],
      ['glass-cleaner-spray','Glasreiniger Spray',500,'ml','🧽'],
      ['glass-cleaner-refill','Glasreiniger Nachfüllpack',1000,'ml','🧽'],
      ['all-purpose-cleaner-spray','Allzweckreiniger Spray',500,'ml','🧽'],
      ['dishwashing-liquid','Handspülmittel',500,'ml','🧽',{aliases:['Spülmittel','Geschirrspülmittel']}],
      ['liquid-soap-refill','Flüssigseife Nachfüllpack',500,'ml','🧼'],
      ['bin-bags-30l','Müllbeutel 30 Liter',20,'St.','🗑️',{aliases:['Müllsäcke 30 Liter']}],
      ['baking-paper-sheets','Backpapier Zuschnitte 38 × 42 cm',20,'St.','🧻'],
      ['dishwashing-sponges','Spülschwämme',3,'St.','🧽'],
      ['dishwasher-tabs-classic','Spülmaschinentabs Classic',40,'St.','🫧'],
      ['dishwasher-salt','Spülmaschinensalz',2000,'g','🫧']
    ];
    const existing=new Set(products.filter(p=>p&&!p.brand&&!p.variantId&&packKey(p.pack)).map(p=>`${p.groupId}|${packKey(p.pack)}`));
    return definitions.flatMap(([id,title,size,unit,emoji,extra={}])=>{
      const p={id:'basic:household-'+id,title,brand:'',variantId:null,isGroupChoice:true,
        pack:{min:size,max:size,unit},category:householdCategory,emoji,...extra,subtitle:`Marke egal · ${packLabel({min:size,unit})}`};
      const profile=profiles(p,brands)[0];
      return !profile||existing.has(`${profile.group}|${packKey(p.pack)}`)?[]:[{...p,groupId:profile.group}];
    });
  }
  function basicGroups(product, products, brands) {
    // Broad list wishes name a food, not a particular brand or cultivar.
    // Keep those wishes separate from exact catalogue products and all opt-in substitutions.
    if (!packKey(product.pack)) return [];
    const title = withoutBrand(product, brands).replace(/\b\d+(?:[.,]\d+)?\s*-?\s*(?:kg|g)\b/g, '').replace(/[.,-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const words = title.split(' ');
    const appleWords = /^(?:apfel|tafelapfel|bio|bioland|demeter|dtsch|deutsche?|deutschen|ital|italienische?|italienischen|frische?|frischen|rot|rote|roten|grun|grune|grunen|gelb|gelbe|gelben|gala|royal|elstar|braeburn|jonagold|jonagored|granny|smith|golden|delicious|pink|lady|im|beutel|netz|schale)$/;
    const freshApples = product.pack.unit === 'g' && words.some(word => /^(?:tafel)?apfel$/.test(word)) && words.every(word => appleWords.test(word));
    const plainPasta = product.pack.unit === 'g' && /^(?:(?:bio|italienische?|getrocknete?|hartweizen|durum|semola)\s+)*(?:spaghetti|spaghettini|penne(?: rigate)?|fusilli|farfalle|rigatoni|maccheroni|pasta|nudeln)(?:\s+(?:verschiedene sorten|versch sorten))?$/.test(title);
    const plainRice = product.pack.unit === 'g' && /^(?:(?:bio|parboiled|basmati|jasmin|langkorn|rundkorn|vollkorn)\s+)*(?:reis|basmatireis|jasminreis|langkornreis|rundkornreis)$/.test(title);
    const yogurtWords=withoutBrand(product,brands).replace(/\b\d+(?:[.,]\d+)?\s*%/g,'').replace(/[.,-]+/g,' ').split(/\s+/).filter(Boolean);
    const naturalYogurt=product.pack.unit==='g' && yogurtWords.includes('naturjoghurt') && yogurtWords.every(w=>/^(?:bio|joghurt|naturjoghurt|mild|milde|milder|fett|natur)$/.test(w));
    const candidates=profileGroups(product,brands);
    return products.filter(wish => !wish.variantId && !wish.brand && packKey(wish.pack) === packKey(product.pack) &&
      (freshApples && wish.groupId === 'aepfel' && normalize(wish.title) === 'apfel' ||
       plainPasta && wish.groupId === 'nudeln' && normalize(wish.title) === 'nudeln' ||
       plainRice && wish.groupId === 'reis' && normalize(wish.title) === 'reis' ||
       naturalYogurt && wish.groupId === 'joghurt' && normalize(wish.title) === 'naturjoghurt' ||
       ['butter','milch-35'].includes(wish.groupId) && profiles(wish,brands).some(p=>candidates.includes(p.group)))).map(wish => wish.groupId);
  }
  function getChoice(product, products = []) {
    return choiceWithBrands(product, knownBrands(products));
  }
  function choiceWithBrands(product, brands) {
    const candidates = profiles(product, brands);
    // A product with several fat levels is an existing assortment choice, not one new fat-level promise.
    const profile = candidates.length === 1 ? candidates[0] : null;
    const choicePack=profile?.kind==='alternative'?{min:Math.ceil(product.pack.min*0.8),max:Math.floor(product.pack.max*1.2),unit:product.pack.unit}:product.pack;
    return {product: profile ? {...product, groupId: profile.group, variantId: null,pack:choicePack,...(profile.kind==='alternative'?{compareByUnit:true,referencePack:product.pack}:{})} : product,
      label: 'Günstigstes passendes Produkt', kind: profile ? profile.kind : 'exact', available: !!product,
      broader: !!profile && profile.kind !== 'same-product',
      description: profile ? profile.description : 'Günstigster erfasster Preis deiner bisherigen Produktauswahl. Für weitere Alternativen fehlen eindeutige Vergleichsangaben.'};
  }
  function createResolver(products = []) {
    const brands=knownBrands(products),cache=new Map();
    return product=>{
      const key=JSON.stringify(product);
      if(!cache.has(key)){
        if(cache.size>=512)cache.clear();
        cache.set(key,choiceWithBrands(product,brands));
      }
      return cache.get(key);
    };
  }
  function annotateOffers(offers, products = []) {
    const byId = new Map(products.map(p => [p.id, p])), brands = knownBrands(products);
    const basics = products.filter(p => !p.variantId && !p.brand &&
      ['aepfel','nudeln','reis','joghurt','butter','milch-35'].includes(p.groupId));
    return (offers || []).map(offer => {
      if (!offer || offer.packUnconfirmed || !['source', 'household'].includes(offer.verification) || !packKey(offer.pack)) return offer;
      const linked = byId.get(offer.productId);
      // The offer's actual title and pack take precedence over its catalogue link.
      const candidate = {...linked, ...offer, title: offer.title || (linked && linked.title), brand: offer.brand || (linked && linked.brand), groupId: linked && linked.groupId};
      // Paper metadata must be present on this offer, not inherited from a linked
      // catalogue variant whose ply or roll count the offer never confirmed.
      for (const field of ['paperLayers','paperTotalSheets','subtitle']) if (!Object.hasOwn(offer,field)) delete candidate[field];
      const additions = basicGroups(candidate, basics, brands).concat(profileGroups(candidate, brands));
      if (!additions.length) return offer;
      const manufacturer = manufacturerDefinition(candidate, brands);
      return {...offer, groupIds: [...new Set([...(offer.groupIds || []), ...additions])],
        ...(manufacturer?{variantIds:[...new Set([...(offer.variantIds||[]),'manufacturer:frosch:'+manufacturer[0]])]}:{})};
    });
  }
  return { getChoice, createResolver, annotateOffers, basicWishes, householdWishes, referenceProducts };
});
