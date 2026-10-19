/* Pure planning logic. Integer cents only. No network access or hidden price estimates. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparnahEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const iso = date => date.toISOString().slice(0, 10);
  const dateOf = value => new Date(value + 'T12:00:00Z');
  function addDays(value, days) { const d = dateOf(value); d.setUTCDate(d.getUTCDate() + days); return iso(d); }
  function berlinToday(now = new Date()) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    return ['year', 'month', 'day'].map(k => p.find(x => x.type === k).value).join('-');
  }
  function nextMonday(today = berlinToday()) {
    const day = dateOf(today).getUTCDay();
    return addDays(today, day === 0 ? 1 : 8 - day);
  }
  function mondayOf(today = berlinToday()) { return addDays(today, -((dateOf(today).getUTCDay() + 6) % 7)); }
  function daysOfWeek(start) { return Array.from({ length: 6 }, (_, i) => addDays(start, i)); }
  function validOn(offer, day) {
    if (!offer.start || day < offer.start) return false;
    // Without an announced end date, only the explicitly advertised starting day is planned.
    return offer.end ? day <= offer.end : day === offer.start;
  }
  function overlapsWeek(offer, start) { return daysOfWeek(start).some(day => validOn(offer, day)); }
  function match(product, offer) {
    if (!product || !Array.isArray(offer.groupIds) || !offer.groupIds.includes(product.groupId)) return { status: 'none' };
    const reasons = [];
    if(offer.packUnconfirmed)reasons.push('Packungsgröße beim Händler nicht bestätigt');
    if (product.variantId) {
      if (!Array.isArray(offer.variantIds) || !offer.variantIds.length) reasons.push('Konkrete Sorte nicht bestätigt');
      else if (!offer.variantIds.includes(product.variantId)) return { status: 'none' };
    }
    if (product.pack) {
      const want = product.pack, have = offer.pack;
      if (!have) { if(!offer.packUnconfirmed)reasons.push('Packungsgröße nicht bestätigt'); }
      else {
        if (want.unit !== have.unit || have.max < want.min || have.min > want.max) return { status: 'none' };
        if (have.min < want.min || have.max > want.max) reasons.push('Passende Packungsgröße nicht eindeutig bestätigt');
      }
    }
    return { status: reasons.length ? 'uncertain' : (product.variantId ? 'exact' : 'group'), reasons };
  }
  function offerUsable(offer, quantity) {
    return !offer.requiresCard && !offer.requiresApp &&
      Number.isSafeInteger(offer.priceCents) && offer.priceCents >= 0 &&
      quantity >= (offer.minQty || 1) && (!offer.maxQty || quantity <= offer.maxQty) &&
      ['source', 'household'].includes(offer.verification);
  }
  function money(cents) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100); }
  function shortDate(value, weekday = false) {
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', ...(weekday ? { weekday: 'short' } : {}), timeZone: 'UTC' }).format(dateOf(value));
  }
  function packLabel(p) {
    if (!p) return 'Packungsgröße offen';
    const number = v => new Intl.NumberFormat('de-DE').format(v);
    return (p.min === p.max ? number(p.min) : number(p.min) + '–' + number(p.max)) + ' ' + p.unit;
  }
  function unitPrice(offer) {
    const p = offer.pack;
    if (!p || !p.min) return '';
    const scale = (p.unit === 'g' || p.unit === 'ml') ? 1000 : 1;
    const unit = p.unit === 'g' ? 'kg' : p.unit === 'ml' ? 'l' : p.unit;
    const a = Math.round(offer.priceCents / p.max * scale), b = Math.round(offer.priceCents / p.min * scale);
    return (a === b ? money(a) : money(a) + '–' + money(b)) + ' / ' + unit;
  }
  function bestOffers(product, offers, { quantity = 1, weekStart = nextMonday(), storeIds = null, notBefore = weekStart } = {}) {
    const days = daysOfWeek(weekStart).filter(day => day >= notBefore);
    return offers.filter(o => (!storeIds || storeIds.includes(o.storeId)) && days.some(day => validOn(o, day)) && offerUsable(o, quantity))
      .map(o => ({ offer: o, match: match(product, o) })).filter(x => x.match.status !== 'none')
      .sort((a, b) => (a.match.status === 'uncertain') - (b.match.status === 'uncertain') || comparisonCost(product,a.offer,quantity)-comparisonCost(product,b.offer,quantity) || a.offer.priceCents-b.offer.priceCents);
  }
  function comparisonCost(product,offer,quantity){
    const reference=product.referencePack,actual=offer.pack;
    // Compare alternatives at the original requested weight; payable totals stay actual cents.
    return product.compareByUnit&&reference&&actual&&reference.min===reference.max&&reference.min>0&&actual.min===actual.max&&actual.min>0&&actual.unit===reference.unit
      ? offer.priceCents*quantity*reference.min/actual.min : offer.priceCents*quantity;
  }
  function storeOpenOn(store,day){return !(store.closedDates||[]).includes(day)&&!(store.temporaryClosureUntil&&day<=store.temporaryClosureUntil&&(!store.temporaryClosureFrom||day>=store.temporaryClosureFrom));}
  function expandOffers(offers,stores){
    const known=new Set(stores.map(s=>s.id));
    return offers.flatMap(o=>Array.isArray(o.applicableStoreIds)&&o.applicableStoreIds.length?[...new Set([o.storeId,...o.applicableStoreIds])].filter(id=>known.has(id)).map(id=>id===o.storeId?o:{...o,id:o.id+':'+id,storeId:id,originOfferId:o.id}):[o]);
  }
  function optimize(items, offers, stores, options = {}) {
    const weekStart = options.weekStart || nextMonday();
    const notBefore = options.notBefore || weekStart;
    const maxStores = Math.max(1, Math.min(3, Number(options.maxStores) || 2));
    const enabled = new Set(options.enabledStores || stores.map(s => s.id));
    // An explicit destination is a shopping decision, never a price or stock claim.
    if (options.targetStoreId && enabled.has(options.targetStoreId)) {
      for (const id of enabled) if (id !== options.targetStoreId) enabled.delete(id);
    }
    const active = items.filter(x => !x.deleted && !x.checked && x.qty > 0);
    const days = daysOfWeek(weekStart).filter(day => day >= notBefore);
    const eligible = offers.filter(o => enabled.has(o.storeId) && days.some(day => validOn(o, day)));
    if (!active.length) return { empty: true, weekStart, count: 0, coverage: 0, visits: [], unknown: [], complete: false };
    // Precompute one best, confirmed line for each item/store/day.
    const matrix = stores.filter(s => enabled.has(s.id)).map(store => ({
      store,
      days: days.filter(day => storeOpenOn(store,day)).map(day => ({
        storeId: store.id, day,
        lines: active.map(item => {
          let best = null;
          for (const offer of eligible) {
            if (offer.storeId !== store.id || !validOn(offer, day) || !offerUsable(offer, item.qty)) continue;
            const m = match(item.product, offer);
            if (!['exact', 'group'].includes(m.status)) continue;
            const cost = offer.priceCents * item.qty, deposit = (offer.depositCents || 0) * item.qty,compareCost=comparisonCost(item.product,offer,item.qty);
            if (!best || compareCost < best.compareCost || (compareCost === best.compareCost && (cost < best.cost || cost === best.cost && deposit < best.deposit))) best = { item, offer, cost, compareCost, deposit, day, storeId: store.id, match: m.status };
          }
          return best;
        })
      }))
    })).filter(s => s.days.some(d => d.lines.some(Boolean)));
    let evaluated = 0;
    function score(visits) {
      const lines = active.map((_, i) => visits.map(v => v.lines[i]).filter(Boolean).sort((a, b) => a.compareCost - b.compareCost || a.cost-b.cost || a.deposit - b.deposit || a.day.localeCompare(b.day) || a.storeId.localeCompare(b.storeId))[0] || null);
      const known = lines.filter(Boolean), used = new Set(known.map(l => l.storeId));
      const daySet = new Set(known.map(l => l.day));
      const total = known.reduce((n, l) => n + l.cost, 0);
      const comparisonTotal = known.reduce((n,l)=>n+l.compareCost,0);
      const deposit = known.reduce((n, l) => n + l.deposit, 0);
      const latest = [...daySet].sort().pop() || weekStart;
      evaluated++;
      return { lines, coverageKey: lines.map(l => l ? '1' : '0').join(''), coverage: known.length, total, comparisonTotal, deposit, usedCount: used.size, dayCount: daySet.size, latest, dayKey: [...daySet].sort().join(',') };
    }
    function better(a, b) {
      return !b || a.coverage > b.coverage || (a.coverage === b.coverage && (
        a.coverageKey > b.coverageKey || (a.coverageKey === b.coverageKey && (a.comparisonTotal < b.comparisonTotal || (a.comparisonTotal === b.comparisonTotal && (
          a.usedCount < b.usedCount || (a.usedCount === b.usedCount && (
            a.dayCount < b.dayCount || (a.dayCount === b.dayCount && (
              a.latest < b.latest || (a.latest === b.latest && a.dayKey < b.dayKey)
            ))
          ))
        ))
      ))));
    }
    function solve(limit) {
      let best = null;
      function inspect(visits) { const candidate = score(visits); if (better(candidate, best)) best = candidate; }
      function combinations(from, chosen) {
        if (chosen.length) {
          if (!options.allowSplitDays) {
            for (const day of days) {
              const visits = chosen.map(s => s.days.find(d => d.day === day));
              if (visits.every(Boolean)) inspect(visits);
            }
          } else {
            // Identical daily price/availability vectors only need the earliest date.
            // Do NOT prune across stores: a later identical day could consolidate visits.
            function dates(i, visits) {
              if (i === chosen.length) { inspect(visits); return; }
              for (const d of chosen[i].days) if (d.lines.some(Boolean)) dates(i + 1, visits.concat(d));
            }
            dates(0, []);
          }
        }
        if (chosen.length === limit) return;
        for (let i = from; i < matrix.length; i++) combinations(i + 1, chosen.concat(matrix[i]));
      }
      combinations(0, []);
      return best || score([]);
    }
    const result = solve(maxStores), one = maxStores === 1 ? result : solve(1);
    const known = result.lines.filter(Boolean);
    // Savings against the saved product require a real price in the same shop
    // on the planned day. Never use an old price, another shop or a guessed RRP.
    for (const line of known) {
      const wish=line.item.requestedProduct, have=line.offer.pack;
      if(!wish || wish.groupId===line.item.product.groupId || !have || !wish.pack ||
        !['g','ml'].includes(have.unit) || have.unit!==wish.pack.unit || have.min!==have.max || have.min<=0 ||
        wish.pack.min!==wish.pack.max || wish.pack.min<=0) continue;
      const original=eligible.filter(o=>o.storeId===line.storeId && validOn(o,line.day) && offerUsable(o,line.item.qty) &&
        !o.packUnconfirmed && o.pack?.min===o.pack?.max && o.pack?.min>0 &&
        (o.productId===wish.id || wish.variantId) && ['exact','group'].includes(match(wish,o).status))
        .sort((a,b)=>a.priceCents/a.pack.min-b.priceCents/b.pack.min)[0];
      if(!original || original.priceCents<=0)continue;
      const before=original.priceCents/original.pack.min,after=line.offer.priceCents/have.min;
      if(after<before)line.unitSaving={originalOffer:original,percent:100*(before-after)/before};
    }
    const visitMap = new Map();
    for (const line of known) {
      if (!visitMap.has(line.storeId)) visitMap.set(line.storeId, { store: stores.find(s => s.id === line.storeId), day: line.day, lines: [], unpriced: [], total: 0, deposit: 0 });
      const visit = visitMap.get(line.storeId); visit.lines.push(line); visit.total += line.cost; visit.deposit += line.deposit;
    }
    const unknown = active.filter((_, i) => !result.lines[i]).map(item => {
      const potential = bestOffers(item.product, eligible, { quantity: item.qty, weekStart, notBefore });
      const confirmed = potential.some(x => ['exact', 'group'].includes(x.match.status));
      return { item, reason: confirmed ? 'Nicht innerhalb der gewählten Geschäfte und Einkaufstage abgedeckt.' : potential.length ? 'Konkrete Sorte oder Packungsgröße im Angebot prüfen.' : 'Kein bestätigter Preis für die gewählte Woche erfasst.', candidates: potential };
    });
    if (!visitMap.size && unknown.length) {
      // With one possible shop the list can be taken there, even when no reliable price is known.
      // This assigns an errand, never a stock claim or a zero-price line.
      const openStores = stores.filter(store => enabled.has(store.id) && days.some(day => storeOpenOn(store,day)));
      if (openStores.length === 1) {
        const store = openStores[0], day = days.find(day => storeOpenOn(store,day));
        visitMap.set(store.id, {store, day, lines: [], unpriced: [], total: 0, deposit: 0});
      }
    }
    if (visitMap.size === 1) {
      const visit = [...visitMap.values()][0];
      for (const entry of unknown) {
        entry.assignedStoreId = visit.store.id;
        entry.assignedDay = visit.day;
        visit.unpriced.push(entry);
      }
    }
    const visits = [...visitMap.values()].sort((a, b) => a.day.localeCompare(b.day) || a.store.name.localeCompare(b.store.name));
    const visitDays = [...new Set(visits.map(visit => visit.day))].sort();
    const referenced = known.filter(l => Number.isSafeInteger(l.offer.referencePriceCents) && l.offer.referencePriceCents >= l.offer.priceCents);
    const referenceSavings = referenced.length ? referenced.reduce((n, l) => n + (l.offer.referencePriceCents - l.offer.priceCents) * l.item.qty, 0) : null;
    const complete = result.coverage === active.length,unitComparisons=active.some(i=>i.product.compareByUnit);
    return { ...result, weekStart, notBefore, count: active.length, complete, empty: false, unknown,
      visits, usedCount: visits.length, dayCount: visitDays.length,
      latest: visitDays[visitDays.length - 1] || result.latest, dayKey: visitDays.join(','),
      referenceSavings, referenceCount: referenced.length,
      cheaperAlternativeCount: known.filter(l=>l.unitSaving).length,
      oneStore: { coverage: one.coverage, total: one.total, complete: one.coverage === active.length },
      unitComparisons,
      extraStoreSavings: !unitComparisons && complete && one.coverage === active.length ? one.total - result.total : null,
      evaluated, assumptions: { allowSplitDays: !!options.allowSplitDays, maxStores, notBefore, oneVisitPerStore: true, travelCostsIncluded: false }
    };
  }
  return { storeOpenOn, expandOffers, berlinToday, nextMonday, mondayOf, addDays, daysOfWeek, validOn, overlapsWeek, match, offerUsable, money, shortDate, packLabel, unitPrice, bestOffers, optimize };
});
