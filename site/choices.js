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
  function alternativeProfile(product, brands) {
    if (!packKey(product.pack) || !['g','ml'].includes(product.pack.unit)) return null;
    const title = withoutBrand(product, brands).replace(/(\d),(\d)/g,'$1.$2').replace(/[,-]+/g,' ').replace(/\s+/g,' ').trim();
    if (/\b(?:oder|verschiedene|sortiment)\b|\//.test(title)) return null;
    let family=null,label=null;
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
      [/^(apfelsaft|orangensaft|traubensaft)(?: (direktsaft|aus konzentrat|naturtrub|klar))?$/, m=>'juice:'+m[1]+':'+(m[2]||'unspecified')],
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
    return {kind:'alternative',group:`choice:alternative:${family}:${product.pack.unit}:${dietaryKey(product)}`,description:`${label} verschiedener Marken, einschließlich Eigenmarken: günstigster ${basis}. Ähnliche Packungen (bis zu 20 % kleiner oder größer als ${packLabel(product.pack)}), gleiche Anzahl Packungen. Tatsächliche Größe, ${basis} und Kassenbetrag werden angezeigt; besondere Ernährungsangaben bleiben erhalten.`};
  }
  function profiles(product, brands) {
    if (!product || product.packUnconfirmed || !packKey(product.pack)) return [];
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
        if (profile.kind !== 'milk') return [profile.group];
        // Unspecified milk processing/pasture wishes may also use a more specific matching milk.
        const groups = [profile.group];
        if (profile.processing !== 'any') groups.push(profile.group.replace(`:${profile.processing}:`, ':any:'));
        if (profile.grazing !== 'any') for (const group of [...groups]) groups.push(group.replace(':pasture:', ':any:'));
        return groups;
      }); }
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
    const candidates = profiles(product, knownBrands(products));
    // A product with several fat levels is an existing assortment choice, not one new fat-level promise.
    const profile = candidates.length === 1 ? candidates[0] : null;
    const choicePack=profile?.kind==='alternative'?{min:Math.ceil(product.pack.min*0.8),max:Math.floor(product.pack.max*1.2),unit:product.pack.unit}:product.pack;
    return {product: profile ? {...product, groupId: profile.group, variantId: null,pack:choicePack,...(profile.kind==='alternative'?{compareByUnit:true,referencePack:product.pack}:{})} : product,
      label: 'Günstigstes passendes Produkt', kind: profile ? profile.kind : 'exact', available: !!product,
      broader: !!profile && profile.kind !== 'same-product',
      description: profile ? profile.description : 'Günstigster erfasster Preis deiner bisherigen Produktauswahl. Für weitere Alternativen fehlen eindeutige Vergleichsangaben.'};
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
      const additions = basicGroups(candidate, basics, brands).concat(profileGroups(candidate, brands));
      if (!additions.length) return offer;
      return {...offer, groupIds: [...new Set([...(offer.groupIds || []), ...additions])]};
    });
  }
  return { getChoice, annotateOffers };
});
