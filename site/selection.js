/* Display the product selected by the planner, without borrowing a generic wish's photo. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparnahSelection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const norm = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
  const exactPack = p => !!p && Number.isFinite(p.min) && p.min > 0 && p.min === p.max && ['g','ml','St','St.','Blatt'].includes(p.unit);
  const samePack = (a, b) => exactPack(a) && exactPack(b) && a.min === b.min && a.unit === b.unit;
  const https = value => { try { return new URL(value).protocol === 'https:'; } catch (_) { return false; } };
  const multiple = title => /\b(?:oder|verschiedene|versch|sortenauswahl)\b|\s\/\s/i.test(String(title || ''));
  function name(product) {
    let value = norm(product.title);
    if (exactPack(product.pack)) {
      const tail = norm(product.pack.min + ' ' + product.pack.unit);
      if (value.endsWith(' ' + tail)) value = value.slice(0, -tail.length - 1);
    }
    return value;
  }
  function packText(pack) {
    return exactPack(pack) ? new Intl.NumberFormat('de-DE').format(pack.min) + ' ' + pack.unit : 'Packungsgröße offen';
  }
  function photoMatches(product) {
    if (product.imageRepresentative || product.imageKind === 'group-representative') return false;
    if (!product.brand && !product.variantId && !product.imageAlt) return false;
    if (!https(product.image) || !https(product.imageSourceUrl || product.manufacturerSourceUrl || product.assortmentSourceUrl)) return false;
    if (!samePack(product.pack, product.imagePack || product.pack) || multiple(product.title)) return false;
    // An explicit image label can disprove the product identity even when the URL looks right.
    if (product.imageAlt) {
      const alt = name({title:product.imageAlt,pack:product.imagePack || product.pack});
      if (alt !== name(product)) return false;
    }
    return true;
  }
  function titleMatches(candidate, offer) {
    const wanted = name(offer), actual = name(candidate), brand = norm(candidate.brand);
    const linkedBrand = brand && (norm(offer.brand) === brand || candidate.id === offer.productId || (offer.variantIds || []).includes(candidate.variantId));
    return actual === wanted || (linkedBrand && actual === brand + ' ' + wanted);
  }
  function butterChoice(item, offer) {
    // These explicit alternatives name a real 250 g butter. Streichzart is not silently substituted.
    const butterGroup = item.groupId === 'butter' || String(item.groupId || '').startsWith('choice:butter:');
    if (!butterGroup || item.variantId || !samePack(item.pack, offer.pack) || offer.pack.min !== 250 || offer.pack.unit !== 'g') return null;
    const title = name(offer);
    if (/^meggle (?:feine )?butter(?: oder streichzart)?$/.test(title)) return /^meggle feine/.test(title) ? 'Meggle Feine Butter' : 'Meggle Butter';
    if (/^landliebe butter(?: oder die streichzarte)?$/.test(title)) return 'Landliebe Butter';
    return null;
  }
  function chosenProduct(itemProduct, offer, products = []) {
    const item = itemProduct || {}, selected = offer || {};
    const catalog = products instanceof Map ? [...products.values()] : (Array.isArray(products) ? products : []);
    const validPack = !selected.packUnconfirmed && exactPack(selected.pack);
    const butter = validPack ? butterChoice(item, selected) : null;
    const target = {...selected,title:butter || selected.title || item.title || 'Produkt'};
    const ambiguous = !validPack || (!butter && multiple(target.title));
    let candidates = [];
    if (!ambiguous) {
      candidates = [...catalog, item].filter(p => samePack(p.pack, selected.pack) && !multiple(p.title) && titleMatches(p,target));
      // A precise wish must not acquire an unrelated variant merely because its title is similar.
      if (item.variantId && !butter) candidates = candidates.filter(p => p.id === selected.productId || p.variantId === item.variantId || (selected.variantIds || []).includes(p.variantId));
      candidates.sort((a,b) => Number(photoMatches(b)) - Number(photoMatches(a)) || Number(b.id === selected.productId) - Number(a.id === selected.productId));
    }
    const picked = candidates[0];
    // Only an image explicitly attached to the offer itself may bypass a catalogue identity.
    const ownPhoto = !ambiguous && photoMatches(selected);
    const source = picked || (ownPhoto ? selected : target);
    const confirmed = !!(!ambiguous && (picked ? photoMatches(picked) : ownPhoto));
    const title = picked ? picked.title : target.title;
    const product = {...source,title,pack:selected.pack || item.pack,image:confirmed ? source.image : null,
      emoji:[source.emoji,item.emoji].find(value=>value && value!=='🛒') || '🛍️',subtitle:packText(selected.pack),displayOnly:true};
    if (!confirmed) { delete product.imageAlt; delete product.imageSourceUrl; delete product.imagePack; }
    return {product,title,imageConfirmed:confirmed,ambiguous,
      label:ambiguous ? (!validPack ? 'Packung noch nicht eindeutig' : 'Sorte laut Angebot wählen') : (confirmed ? '' : 'Produktfoto fehlt')};
  }
  return {chosenProduct};
});
