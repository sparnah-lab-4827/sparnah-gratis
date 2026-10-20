/* Editable, generic shopping routes. These are suggestions, not surveyed aisle plans. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparnahShopping = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const colors = Object.freeze(['#22c55e', '#f59e0b', '#a78bfa', '#f472b6', '#38bdf8', '#94a3b8', '#60a5fa', '#fb7185', '#2dd4bf', '#a3a3a3']);
  const colorLabels = ['Grün', 'Bernstein', 'Violett', 'Rosa', 'Hellblau', 'Blaugrau', 'Blau', 'Koralle', 'Türkis', 'Grau'];
  const icons = Object.freeze(['🥬', '🥖', '🥫', '🍫', '🥤', '🧽', '🥛', '🥩', '❄️', '🛒', '📍', '⭐']);
  const defaults = [
    ['produce', 'Obst & Gemüse', '🥬', colors[0]],
    ['bakery', 'Brot & Backwaren', '🥖', colors[1]],
    ['pantry', 'Vorrat & Grundnahrungsmittel', '🥫', colors[2]],
    ['sweets', 'Süßes & Snacks', '🍫', colors[3]],
    ['drinks', 'Getränke', '🥤', colors[4]],
    ['household', 'Haushalt & Drogerie', '🧽', colors[5]],
    ['dairy', 'Milchprodukte & Kühlung', '🥛', colors[6]],
    ['meat', 'Fleisch, Wurst & Fisch', '🥩', colors[7]],
    ['frozen', 'Tiefkühlkost', '❄️', colors[8]],
    ['other', 'Sonstiges', '🛒', colors[9]]
  ].map(([id, label, icon, color]) => ({ id, label, icon, color }));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' ? value : '';
  const norm = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ß/g, 'ss').trim();
  const label = (value, fallback) => Array.from(text(value).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 40).join('') || fallback;
  const safeKey = key => typeof key === 'string' && key.length > 0 && key.length <= 250 && !['__proto__', 'prototype', 'constructor'].includes(key);
  const safeId = id => safeKey(id) && /^[a-z][a-z0-9_-]{0,63}$/.test(id);
  function proposed(retailerId) {
    // Retailer-wide starting points only; users set their own actual walking order.
    const order = retailerId === 'kaufland'
      ? ['produce', 'bakery', 'meat', 'dairy', 'pantry', 'sweets', 'drinks', 'household', 'frozen', 'other']
      : defaults.map(area => area.id);
    return order.map(id => ({ ...defaults.find(area => area.id === id) }));
  }
  function layout(retailerId, saved) {
    const areas = [], seen = new Set();
    if (record(saved) && Array.isArray(saved.areas)) {
      for (const raw of saved.areas) {
        if (!record(raw) || !safeId(raw.id) || seen.has(raw.id)) continue;
        const base = defaults.find(area => area.id === raw.id) || defaults[9];
        areas.push({ id: raw.id, label: label(raw.label, base.label), icon: icons.includes(raw.icon) ? raw.icon : base.icon, color: colors.includes(raw.color) ? raw.color : base.color });
        seen.add(raw.id);
        if (areas.length >= 40) break;
      }
    }
    if (!areas.length) areas.push(...proposed(retailerId));
    if (!areas.some(area => area.id === 'other')) areas.push({ ...defaults[9] });
    const ids = new Set(areas.map(area => area.id)), assignments = {};
    if (record(saved) && record(saved.assignments)) {
      for (const [key, value] of Object.entries(saved.assignments)) {
        if (safeKey(key) && typeof value === 'string') assignments[key] = ids.has(value) ? value : 'other';
      }
    }
    return { areas, assignments };
  }
  function classify(product) {
    product = record(product) ? product : {};
    const category = norm(product.category);
    const title = norm(product.name || product.title);
    // Explicit frozen information outranks broad categories such as vegetables or meat.
    if (/\b(tiefkuhl\w*|tiefgekuhlt\w*|gefroren\w*|tk|frozen)\b/.test(category + ' ' + title) ||
        /^(?:speiseeis|eiscreme|eis)$/.test(category) ||
        /^(?:frosta|iglo)$/.test(norm(product.brand))) return 'frozen';
    const categoryRules = [
      ['household', /\b(haushalt|drogerie|korperpflege|reinigung|waschmittel|tierbedarf|tierfutter|non.?food)\b/],
      ['drinks', /\b(getranke|wasser|safte|saft|bier|wein|spirituosen)\b/],
      ['sweets', /\b(susswaren|susses|snacks|knabber\w*|schokolade|kekse)\b/],
      ['pantry', /\b(vorrat|grundnahrungsmittel|konserven|nudeln|pasta|reis|backzutaten|gewurze|saucen|sossen|aufstriche|kaffee|tee|fertiggerichte|müsli|musli|cerealien)\b/],
      ['dairy', /\b(milchprodukte|molkerei\w*|kuhl\w*|joghurt|kase|eier|milch|butter)\b/],
      ['meat', /\b(fleisch|wurst|fisch|geflugel|metzgerei)\b/],
      ['bakery', /\b(brot|backwaren|backerei|backshop)\b/],
      ['produce', /\b(obst|gemuse|fruchte|salate|produce)\b/]
    ];
    const categoryMatches = categoryRules.filter(([, pattern]) => pattern.test(category)).map(([id]) => id);
    if (categoryMatches.length === 1) return categoryMatches[0];
    // Some catalogue categories combine different aisles (for example bread,
    // spreads and cereals). A clear product name resolves those mixed categories.
    // Ingredients after "mit" do not determine a product's department.
    const main = title.split(/\b(?:mit|gefullt|fullung|geschmack|zutaten)\b/)[0];
    const nameRules = [
      ['household', /\b(toilettenpapier|kuchenrollen?|kuchentucher|waschmittel|spulmittel|allzweckreiniger|shampoo|zahnpasta|duschgel|windeln|katzenfutter|hundefutter)\b/],
      ['frozen', /\b(speiseeis|eiscreme|vanilleeis|schokoladeneis|fischstabchen)\b/],
      ['sweets', /\b(schokolade|vollmilchschokolade|zartbitterschokolade|kekse|butterkekse|gummibarchen|chips|kartoffelchips|pralinen|schokoriegel|bonbons)\b/],
      ['drinks', /\b(mineralwasser|wasser|apfelsaft|orangensaft|fruchtsaft|saft|cola|limonade|bier|pils|wein|rotwein|weisswein|sekt|energydrink|eistee)\b/],
      ['pantry', /\b(konserven?|dose|dosentomaten|tomatenmark|passierte|nudeln|pasta|spaghetti|reis|basmati|mehl|zucker|salz|olivenol|sonnenblumenol|rapsol|essig|ketchup|senf|sauce|sosse|pesto|musli|haferflocken|kaffee|tee|marmelade|konfiture|honig|nutella|erdnussbutter|kokosmilch|haferdrink|sojadrink|mandeldrink)\b/],
      ['bakery', /\b(brot|toast|toastbrot|vollkornbrot|brotchen|croissants?|brezeln?|baguette|kuchen)\b/],
      ['dairy', /\b(milch|vollmilch|h-milch|butter|margarine|joghurt|jogurt|quark|skyr|sahne|schmand|kase|frischkase|gouda|mozzarella|feta|eier)\b/],
      ['meat', /\b(fleisch|hackfleisch|rinderhack|hack|hahnchen|hahnchenbrust|putenbrust|bratwurst|wurst|schinken|salami|lachs|forelle|steak|schnitzel)\b/],
      ['produce', /\b(apfel|bananen?|birnen?|orangen?|zitronen?|erdbeeren?|heidelbeeren?|trauben|kartoffeln?|tomaten?|gurken?|paprika|brokkoli|blumenkohl|karotten?|mohren?|zwiebeln?|knoblauch|zucchini|avocados?|salat|spinat|pilze|champignons)\b/]
    ];
    for (const [id, pattern] of nameRules) if (pattern.test(main)) return id;
    return categoryMatches[0] || 'other';
  }
  function resolve(product, current, assignmentId) {
    const keys = [assignmentId, product && product.id];
    for (const key of keys) {
      if (safeKey(key) && own(current.assignments, key)) return current.areas.find(area => area.id === current.assignments[key]);
    }
    return current.areas.find(area => area.id === classify(product)) || current.areas.find(area => area.id === 'other');
  }
  function areaFor(product, current, assignmentId) { return resolve(product, layout(null, current), assignmentId); }
  function group(entries, current) {
    const normalized = layout(null, current);
    const groups = normalized.areas.map(area => ({ area, entries: [] }));
    const byId = new Map(groups.map(group => [group.area.id, group]));
    for (const entry of Array.isArray(entries) ? entries : []) {
      const area = resolve(entry && entry.product, normalized, entry && entry.itemId);
      byId.get(area.id).entries.push(entry);
    }
    return groups.filter(group => group.entries.length);
  }
  function moveArea(current, id, delta) {
    const result = layout(null, current), index = result.areas.findIndex(area => area.id === id);
    if (index < 0 || typeof delta !== 'number' || !Number.isFinite(delta)) return result;
    const target = Math.max(0, Math.min(result.areas.length - 1, index + Math.trunc(delta)));
    result.areas.splice(target, 0, result.areas.splice(index, 1)[0]);
    return result;
  }
  function updateArea(current, id, changes) {
    const result = layout(null, current), area = result.areas.find(area => area.id === id);
    if (!area || !record(changes)) return result;
    if (own(changes, 'label')) area.label = label(changes.label, area.label);
    if (colors.includes(changes.color)) area.color = changes.color;
    if (icons.includes(changes.icon)) area.icon = changes.icon;
    return result;
  }
  function addArea(current, name) {
    const result = layout(null, current);
    if (result.areas.length >= 40) return result;
    let index = 1;
    while (result.areas.some(area => area.id === 'custom-' + index)) index++;
    result.areas.splice(result.areas.findIndex(area => area.id === 'other'), 0, { id: 'custom-' + index, label: label(name, 'Neuer Bereich'), icon: '📍', color: colors[index % colors.length] });
    return result;
  }
  function removeArea(current, id) {
    const result = layout(null, current);
    if (id === 'other') return result;
    result.areas = result.areas.filter(area => area.id !== id);
    for (const key of Object.keys(result.assignments)) if (result.assignments[key] === id) result.assignments[key] = 'other';
    return result;
  }
  function assign(current, productId, areaId) {
    const result = layout(null, current);
    if (safeKey(productId)) result.assignments[productId] = result.areas.some(area => area.id === areaId) ? areaId : 'other';
    return result;
  }
  return Object.freeze({ layout, group, areaFor, moveArea, updateArea, addArea, removeArea, assign,
    colors: Object.freeze(colors.map((value, index) => Object.freeze({ value, label: colorLabels[index] }))), icons });
});
