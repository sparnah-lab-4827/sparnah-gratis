/* Sparnah UI and offline operation queue. No framework or third-party scripts. */
'use strict';
(() => {
  const Vault = window.SparnahVault, privateData = Vault?.getData();
  if (!privateData) return; // Keep saved lists untouched until authenticated access.
  const E = window.SparnahEngine, S = window.SparnahSearch, Choices = window.SparnahChoices, Selection = window.SparnahSelection, Shopping = window.SparnahShopping;
  let preparedOffers = [];
  let assortment = privateData.assortment, assortmentError = '', searchIndex;
  let C = privateData.catalog, storeAliases = {};
  const STORAGE_KEY = 'sparnah-v1'; // Existing local lists and market selections stay on this device.
  let importStatus = privateData.status;
  let leafletData = privateData.leaflets, leafletError = '', leafletLoaded = true;
  let privateDataWarning = '', automaticUpdates;
  const IS_FILE = location.protocol === 'file:';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
  const storeUrl = value => { try { const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''; } catch{return '';} };
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
  const clone = value => JSON.parse(JSON.stringify(value));
  const paths = {
    bag: '<path d="M5 7h14l1 13H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/><path d="m9 14 2 2 4-4"/>',
    list: '<rect x="5" y="4" width="15" height="17" rx="2"/><path d="M9 2v4m7-4v4M8 10h2m3 0h4m-9 4h2m3 0h4m-9 4h2m3 0h4"/>',
    tag: '<path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    route: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m10 3-1 3-3 1-3-1-1 4 3 2v2l-2 2 2 3 3-1 2 2 1 2 4-1v-3l2-1 3 1 2-4-3-2v-2l2-2-2-3-3 1-2-2-1-2-3 1Z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>', chevron: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m5 12 4 4L19 6"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3m-9 0 1 15h10l1-15M10 10v7m4-7v7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h3m3 0h2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 12 3 3 5-5"/>',
    sparkle: '<path d="m12 3 2 6 7 3-7 2-2 7-2-7-7-2 7-3 2-6ZM20 2v4m-2-2h4"/>',
    share: '<circle cx="18" cy="4" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="20" r="3"/><path d="m9 10 6-4m-6 8 6 4"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>',
    cloud: '<path d="M6 18h12a4 4 0 0 0 1-8 7 7 0 0 0-13-2 5 5 0 0 0 0 10Z"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    print: '<path d="M6 8V3h12v5M6 18H3V9h18v9h-3M6 14h12v8H6v-8Z"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5m-4-4a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3"/>',
    leaf: '<path d="M20 3c-1 8-1 16-10 16a6 6 0 0 1-6-6C4 5 13 6 20 3ZM4 21l10-10"/>',
    external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  };
  const icon = (name, extra = '') => `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.bag}</svg>`;
  const defaultState = () => ({ revision: 0, items: [], offers: [], settings: { maxStores: 2, allowSplitDays: true, enabledStores: [], knownStoreIds: C.stores.map(s => s.id) } });
  let storageAvailable = true, saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { storageAvailable = false; }
  let model = saved?.base && Array.isArray(saved.base.items) && Array.isArray(saved.base.offers) && saved.base.settings ? saved : { base: defaultState(), outbox: [], token: null, photos: true };
  if (!Array.isArray(model.outbox)) model.outbox = [];
  // Einmaliger Import vorhandener Änderungen aus einer älteren lokalen Fassung.
  // Kein privater Haushalt wird an GitHub übermittelt.
  for (const old of model.outbox) { try { apply(model.base, old); } catch {} }
  model.outbox=[]; model.token=null;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(model)); } catch {}

  const ui = { tab: 'list', leafletMode:'today', query: '', searchStore:'all', searchCategory:'all', searchLimit:24, searchOpen: false, selected: -1, weekMode: model.weekMode==='next'?'next':'current', offerStore: 'all', offerQuery: '', brandQuery:'', brandStore:'all', brandOpen:false, brandSelected:-1, storeQuery:'', online: false, syncBusy: false, lastSynced: null, syncError: '', hideDone: false, health: IS_FILE ? 'standalone' : 'checking' };
  let toastTimer, memoKey = '', memoPlan, apiBusy = false;
  let resolveChoice, priceGuide, selectedProductCache=new WeakMap(),searchMemo;
  let guideQuery='';

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(model)); }
    catch { storageAvailable = false; toast('Speicherung im Browser nicht möglich. Bitte Liste als Sicherung exportieren.'); }
  }
  function apply(state, op) {
    if (op.type.startsWith('item.')) {
      const item = state.items.find(i => i.id === op.itemId);
      if (op.type === 'item.add') {
        if (!item) state.items.push({ id: op.itemId, product: clone(op.product), qty: op.qty || 1, checked: false, deleted: false });
        else if (item.deleted) Object.assign(item, { qty: op.qty || 1, product: clone(op.product), checked: false, deleted: false });
        else { item.qty = Math.min(99, item.qty + (op.qty || 1)); item.checked = false; }
      } else if (item) {
        if (op.type === 'item.remove') item.deleted = true;
        else if (!item.deleted && op.type === 'item.delta') item.qty = Math.min(99, Math.max(1, item.qty + op.delta));
        else if (!item.deleted && op.type === 'item.check') item.checked = op.checked;
        else if (!item.deleted && op.type === 'item.choice' && ['exact','cheapest'].includes(op.mode)) item.choiceMode = op.mode;
      }
    } else if (op.type === 'settings') Object.assign(state.settings, clone(op.settings));
    else if (op.type === 'offer.add') state.offers = state.offers.filter(o => o.id !== op.offer.id).concat(clone(op.offer));
    else if (op.type === 'offer.remove') state.offers = state.offers.filter(o => o.id !== op.offerId);
  }
  function state() { return clone(model.base); }
  function perform(op, rerender = true) {
    op.id = uid();
    apply(model.base, op);
    persist(); memoKey = '';
    if (['item.add','item.remove','offer.add','offer.remove'].includes(op.type)) reindex();
    if (rerender) render();
    if(op.type==='settings'&&Array.isArray(op.settings?.enabledStores))void automaticUpdates?.selectionChanged();

  }
  function reindex(){
    memoKey='';
    const settings=S.reconcileStores(model.base.settings,C.stores);
    if(JSON.stringify(settings)!==JSON.stringify(model.base.settings)){model.base.settings=settings;persist();}
    searchIndex=S.build(C.products,assortment.products,model.base.items.filter(i=>!i.deleted).map(i=>i.product));
    priceGuide=window.SparnahEstimates?.createEstimator(searchIndex.products);
    resolveChoice=Choices.createResolver(searchIndex.products);
    selectedProductCache=new WeakMap();searchMemo=null;
    preparedOffers=Choices.annotateOffers(E.expandOffers(C.offers.concat(model.base.offers),C.stores),searchIndex.products);
  }
  const product = id => searchIndex?.byId.get(id) || model.base.items.find(i=>i.id===id)?.product;
  const store = id => C.stores.find(s => s.id === (storeAliases[id]||id));
  function sourceStatusFor(st){return importStatus?.stores?.[st.id]||(st.retailerId==='aldi'&&C.offers.some(o=>o.applicableStoreIds?.includes(st.id))?importStatus?.stores?.aldi:null);}
  const offers = () => preparedOffers;
  const weekStart = () => ui.weekMode === 'current' ? E.mondayOf() : E.nextMonday();
  const weekText = () => `${E.shortDate(weekStart())} – ${E.shortDate(E.addDays(weekStart(), 5))}`;
  const weekName = () => ui.weekMode === 'current' ? 'Diese Woche' : 'Nächste Woche';
  const allProducts = () => searchIndex.products;
  function activeItems() { return state().items.filter(i => !i.deleted && !i.checked); }
  function hasSelectedStores() { return state().settings.enabledStores.some(id=>C.stores.some(store=>store.id===id)); }
  function marketSelectionPrompt() {
    return hasSelectedStores()?'':`<section class="notice" aria-label="Märkte auswählen"><h2>Wähle deine Märkte.</h2><p class="small" style="margin-top:8px">Du entscheidest, welche Geschäfte in Angebote, Prospekte und Sparplan einfließen. Deine Auswahl bleibt auf diesem Gerät.</p><button class="primary" style="margin-top:12px" data-action="tab" data-tab="stores">${icon('pin')} Märkte auswählen</button></section>`;
  }
  function effectiveProduct(item) { return item.choiceMode==='cheapest' ? resolveChoice(item.product).product : item.product; }
  const priceKind = o => o.priceKind==='regular' ? 'Normalpreis' : o.verification==='household' ? 'Eigener Preis' : 'Angebot';
  const selectedProduct = line => {
    if(!selectedProductCache.has(line))selectedProductCache.set(line,Selection.chosenProduct(line.item.product,line.offer,allProducts()));
    return selectedProductCache.get(line);
  };
  function getPlan() {
    // Every state/catalog mutation invalidates memoKey; don't serialize all offers
    // just to reuse an unchanged plan while navigating or opening a product.
    const today=E.berlinToday(), week=weekStart(), key=week+'|'+today;
    if (key !== memoKey) { const s=state();memoPlan = E.optimize(s.items.map(i=>({...i,requestedProduct:i.product,product:effectiveProduct(i)})), offers(), C.stores, { ...s.settings, weekStart:week, notBefore:today }); memoKey = key; }
    return memoPlan;
  }
  function thumb(p, extra = '', resolved = false) {
    const current=searchIndex?.byId.get(p?.id);
    const visual=resolved?p:S.visualProduct(p,current);
    const image = model.photos !== false && safeUrl(visual?.image);
    const label = p?.variantId ? 'Produktbild' : 'Beispielbild';
    return `<span class="thumb ${extra}" role="img" aria-label="${esc('Symbolbild: ' + (p?.title || 'Produkt'))}" data-image-label="${esc(visual?.imageAlt || label + ': ' + (p?.title || 'Produkt'))}" data-caption="${esc(label)}"><span class="emoji" aria-hidden="true">${esc(p?.emoji || '🛒')}</span>${image ? `<img src="${esc(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>`;
  }
  function badge(s,standalone=false) {
    const logo=window.SparnahLogos?.source(s);
    return logo?`<span class="store-badge retailer-logo"><img src="${esc(logo)}" alt="${standalone?esc(s?.name):''}" width="40" height="30" decoding="async"></span>`:`<span class="store-badge" style="--store-color:${esc(/^#[a-f\d]{6}$/i.test(s?.color || '') ? s.color : '#677b5c')}">${esc(s?.short || '?')}</span>`;
  }
  function storePicker(id,shops,value,allLabel=null,allValue='all',label='Geschäft auswählen') {
    const selected=shops.find(s=>s.id===value),title=selected?.name||allLabel||shops[0]?.name||'Keine Geschäfte';
    const rows=(allLabel!==null?[{id:allValue,name:allLabel,all:true}]:[]).concat(shops);
    return `<div class="store-picker-wrap"><select id="${id}" hidden aria-hidden="true" tabindex="-1">${rows.map(s=>`<option value="${esc(s.id)}" ${value===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><details class="store-picker" id="${id}-picker"><summary id="${id}-button" aria-label="${esc(label+': '+title)}">${selected?badge(selected):icon('bag')}<span>${esc(title)}</span>${icon('chevron')}</summary><div class="store-picker-options" role="group" aria-label="${esc(label)}">${rows.map(s=>`<button type="button" data-action="pick-store" data-control="${id}" data-value="${esc(s.id)}" aria-pressed="${s.id===value}">${s.all?icon('bag'):badge(s)}<span>${esc(s.name)}</span>${s.id===value?icon('check'):''}</button>`).join('')}</div></details></div>`;
  }
  function chooseStore(id,value) {
    if(id==='offer-store'){ui.offerStore=value;render();}
    else if(id==='brand-store'){ui.brandStore=value;render();}
    else if(id==='plan-destination')perform({type:'settings',settings:{targetStoreId:value}});
    else if(id==='search-store'){ui.searchStore=value;ui.searchLimit=24;ui.selected=-1;ui.searchOpen=true;render();}
    else if(id==='offer-shop'){
      const shop=store(value);if(!shop)return;
      $('offer-shop').value=value;$('offer-source').value=shop.url;
      $('offer-shop-picker').parentElement.outerHTML=storePicker(id,C.stores,value,null);
    }
    $(id+'-button')?.focus({preventScroll:true});
  }
  function status() { return {label:'Nur dieses Handy',dot:'ok',icon:'shield'}; }
  function renderHeader() {
    const t = status(), count = activeItems().length;
    $('header').innerHTML = `<a class="brand" href="#" data-action="tab" data-tab="list" aria-label="Sparnah – zur Einkaufsliste"><span class="brand-mark">${icon('bag')}</span><span>Sparnah<small>Clever einkaufen.</small></span></a><div class="header-right"><button class="header-settings ${ui.tab==='settings'||ui.tab==='stores'?'active':''}" data-action="tab" data-tab="settings" aria-label="Einstellungen und Händlerauswahl" title="Einstellungen und Händlerauswahl">${icon('settings')}</button><button class="location-pill" data-action="tab" data-tab="stores" aria-label="Ausgewählte Märkte ändern">${icon('pin')} Ausgewählte Märkte <span class="muted">· ${state().settings.enabledStores.filter(id=>C.stores.some(store=>store.id===id)).length}</span></button><span class="sync-pill" title="Die Liste bleibt nur auf diesem Handy">${icon(t.icon)}<span>${t.label}</span><span class="status-dot ${t.dot}"></span></span></div>`;
    const tabs=[['list','list','Einkaufsliste'],['offers','tag','Angebote'],['brands','search','Marken'],['leaflets','calendar','Prospekte'],['plan','route','Sparplan'],['stores','pin','Läden'],['settings','settings','Einstellungen']];
    const activeTab=['shopping','market-layout'].includes(ui.tab)?'plan':ui.tab;
    const navButton=([tab,ic,label],mobile=false)=>`<button class="nav-item ${activeTab === tab ? 'active' : ''}" data-action="tab" data-tab="${tab}" ${activeTab === tab ? 'aria-current="page"' : ''}>${icon(ic)}<span class="nav-label">${mobile&&tab==='list'?'Liste':label}</span>${tab === 'list' && count ? `<span class="nav-count">${count}</span>` : ''}</button>`;
    $('side-nav').innerHTML = tabs.map(tab=>navButton(tab)).join('') + `<div class="sidebar-bottom"><div class="sidebar-note">${icon('leaf')}<p>Weniger suchen.<br>Bewusster einkaufen.</p></div><div class="sidebar-version">SPARNAH · GRATIS-VERSION</div></div>`;
    $('bottom-nav').innerHTML = tabs.slice(0,5).map(tab=>navButton(tab,true)).join('');
  }
  function selectedData(){return window.SparnahUpdates.scope(C,importStatus,state().settings.enabledStores);}
  function dataBanner() {
    const selected=selectedData(),failed=selected.failures;
    const updated=importStatus?.lastSuccessAt ? new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(importStatus.lastSuccessAt)) : null;
    const label=!selected.stores.length?'Keine Läden ausgewählt':`${selected.prices.length} erfasste Preise für deine ${selected.stores.length} ausgewählten Läden${updated?' · Veröffentlichter Prüfstand: '+updated:''}`;
    return `<button class="data-banner" data-action="sources">${icon('info')}<span><strong>${esc(label)}</strong><br class="mobile-only"><span class="desktop-only"> &nbsp;·&nbsp; </span>${failed ? `${failed} Händlerabruf(e) fehlgeschlagen · Details anzeigen` : 'Die Quellenabdeckung ist unvollständig · Datenstand ansehen'}</span>${icon('chevron','arrow')}</button>`;
  }
  function weekSwitch() {
    const enabled=state().settings.enabledStores;
    const counts=mode=>offers().filter(o=>enabled.includes(o.storeId)&&E.overlapsWeek(o,mode==='current'?E.mondayOf():E.nextMonday())&&E.offerUsable(o,Math.max(1,o.minQty||1))).length;
    const count=counts(ui.weekMode),other=ui.weekMode==='current'?'next':'current',otherCount=counts(other);
    return `<div class="week-switch" aria-label="Planungswoche"><button class="chip ${ui.weekMode === 'current' ? 'selected' : ''}" aria-pressed="${ui.weekMode==='current'}" data-action="week" data-week="current">Diese Woche</button><button class="chip ${ui.weekMode === 'next' ? 'selected' : ''}" aria-pressed="${ui.weekMode==='next'}" data-action="week" data-week="next">Nächste Woche</button><span class="tiny muted">${weekText()} · ${enabled.length?count+' zugeordnete Preise':'Keine Märkte gewählt'}</span></div>${enabled.length&&!count?`<div class="notice week-notice"><strong>Für ${ui.weekMode==='next'?'nächste':'diese'} Woche sind noch keine verwendbaren Preise erfasst.</strong><p>Damit lässt sich noch kein günstigster Laden berechnen. Sortimentshinweise findest du trotzdem bei offenen Produkten.</p>${otherCount?`<button class="text-button" data-action="week" data-week="${other}">${otherCount} Angebote ${other==='current'?'dieser':'nächster'} Woche ansehen ${icon('arrow')}</button>`:''}</div>`:''}`;
  }
  function maxStoreSelector() { const s = state().settings; return `<div class="segmented" role="group" aria-label="Maximale Anzahl Geschäfte">${[1,2,3].map(n => `<button class="${s.maxStores === n ? 'selected' : ''}" aria-pressed="${s.maxStores === n}" data-action="max-stores" data-value="${n}">${n} ${n === 1 ? 'Laden' : 'Läden'}</button>`).join('')}</div>`; }
  function searchMarkup() { return `<div class="search-wrap"><div class="search-filters"><div class="search-filter-label">Katalogquelle${storePicker('search-store',[{id:'aldi',name:'ALDI',retailerId:'aldi'},{id:'kaufland',name:'Kaufland',retailerId:'kaufland'}],ui.searchStore,'Alle Produkte','all','Katalogquelle')}</div><label>Kategorie<select id="search-category" aria-label="Produktkategorie"><option value="all">Alle Kategorien</option>${searchIndex.categories.map(c=>`<option ${ui.searchCategory===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label></div><div class="search-input-area"><div class="search-box">${icon('search')}<input id="search" type="search" autocomplete="off" spellcheck="false" placeholder="Produkt suchen, z. B. Milch …" value="${esc(ui.query)}" role="combobox" aria-label="Produkt suchen" aria-autocomplete="list" aria-controls="suggestions" aria-expanded="${ui.searchOpen}"><span class="search-shortcut">/</span></div><div id="suggestions" class="suggestions" role="listbox" aria-label="Produktvorschläge" hidden></div></div><p class="search-help">${icon('sparkle')} Marke, Sorte oder Packungsgröße suchen, z. B. Milch 1.000 ml.</p><p class="tiny muted">${allProducts().length.toLocaleString('de-DE')} erfasste Produkte · Händlerabdeckung unvollständig · <button class="text-button" data-action="sources">Quellen und Abdeckung</button>${assortmentError?' · '+esc(assortmentError):''}</p></div>`; }
  function matching(p, qty = 1) { return E.bestOffers(p, offers(), { quantity: qty, weekStart: weekStart(), notBefore:E.berlinToday(), storeIds: state().settings.enabledStores }); }
  function offerHint(p, qty = 1) {
    const found = matching(p, qty), first = found.find(x => x.match.status !== 'uncertain');
    if (first) return `<span class="offer-line">${badge(store(first.offer.storeId))}${esc(store(first.offer.storeId)?.name)} · ${E.money(first.offer.priceCents)} / Packung</span>`;
    return `<span class="offer-line ${found.length ? 'uncertain' : 'muted'}">${found.length ? `${icon('info')} Sorte / Größe prüfen` : 'Noch kein bestätigtes Angebot'}</span>`;
  }
  function choiceButtons(item) {
    const cheapest=item.choiceMode==='cheapest', choice=resolveChoice(item.product);
    return `<div class="product-choice" role="group" aria-label="Produktauswahl für ${esc(item.product.title)}"><button data-action="item-choice" data-id="${esc(item.id)}" data-mode="exact" aria-pressed="${!cheapest}">Meine Auswahl</button><button data-action="item-choice" data-id="${esc(item.id)}" data-mode="cheapest" aria-pressed="${cheapest}">Günstigstes passendes Produkt</button></div>${cheapest?`<p class="choice-description">${esc(choice.description)}</p>`:''}`;
  }
  function packChange(line){
    const original=(line.item.requestedProduct||line.item.product).pack,actual=line.offer.pack;
    return original&&actual&&(original.min!==actual.min||original.max!==actual.max||original.unit!==actual.unit)?`${E.packLabel(actual)} statt ${E.packLabel(original)} je Packung`:'';
  }
  function itemRow(item, line) {
    const selected=line?selectedProduct(line):null;
    return `<div class="list-row ${item.checked ? 'checked' : ''}" data-item="${esc(item.id)}"><button class="check ${item.checked ? 'done' : ''}" data-action="check" data-id="${esc(item.id)}" role="checkbox" aria-checked="${!!item.checked}" aria-label="${esc(item.product.title)} als ${item.checked ? 'offen' : 'erledigt'} markieren">${item.checked ? icon('check') : ''}</button>${thumb(selected?.product||item.product,'',!!selected)}<div class="grow"><button class="product-title" data-action="product" data-id="${esc(item.id)}">${esc(item.product.title)}</button><div class="product-sub">${esc(productSubtitle(item.product))}</div>${item.checked ? '<span class="offer-line muted">Erledigt</span>' : line?`<p class="selected-product">Im Plan: ${esc(selected.title)}</p>${packChange(line)?`<p class="pack-change"><strong>${esc(packChange(line))}</strong> · ${esc(E.unitPrice(line.offer))}</p>`:''}<span class="offer-line">${badge(store(line.storeId))}${esc(store(line.storeId)?.name)} · ${E.money(line.offer.priceCents)} / Packung · ${priceKind(line.offer)}</span>${unitSavingMarkup(line)}${selected.label?`<p class="tiny muted">${esc(selected.label)}</p>`:''}`:`<span class="offer-line muted">${hasSelectedStores()?'Bestätigter Preis im gewählten Einkaufsplan noch offen':'Wähle Märkte für den Preisvergleich'}</span>${estimateMarkup(item)}`} ${!item.checked?choiceButtons(item):''}</div><div class="row-end"><div class="quantity"><button data-action="quantity" data-id="${esc(item.id)}" data-delta="-1" aria-label="Eine Packung weniger: ${esc(item.product.title)}" ${item.qty <= 1 ? 'disabled' : ''}>${icon('minus')}</button><span aria-label="${item.qty} Packungen">${item.qty}</span><button data-action="quantity" data-id="${esc(item.id)}" data-delta="1" aria-label="Eine Packung mehr: ${esc(item.product.title)}" ${item.qty >= 99 ? 'disabled' : ''}>${icon('plus')}</button></div><button class="delete-button" data-action="remove-item" data-id="${esc(item.id)}" aria-label="${esc(item.product.title)} entfernen">${icon('trash')}</button></div></div>`;
  }
  function plannerAside() { return `<aside class="planner-aside"><div class="planner-card"><div class="row"><span class="planner-icon">${icon('route')}</span><h2>Dein Sparplan</h2></div><p class="intro">Angebote und Normalpreise. Passende Einkaufstage. Alles in einem Plan.</p><div class="week-tile">${icon('calendar')}<div><div class="label">${weekName()}</div><div class="value">${weekText()}</div></div></div><button class="text-button" data-action="tab" data-tab="settings">${icon('settings')} Einkaufsplanung einstellen</button><p class="planner-note">${icon('info')}Wir vergleichen nur bestätigte, erfasste Preise. Fehlende Preise bleiben offen.</p><button class="primary wide" data-action="tab" data-tab="plan">${weekName()} planen ${icon('arrow')}</button><p class="no-card">${icon('shield')} Keine Kundenkarten. Keine App-Coupons.</p><div class="store-strip">${C.stores.filter(st=>state().settings.enabledStores.includes(st.id)).slice(0,5).map(s=>badge(s,true)).join('')}<small>${hasSelectedStores()?state().settings.enabledStores.length+' Märkte ausgewählt':'Keine Märkte ausgewählt'}</small></div></div><div class="hint-card"><div class="row"><div class="grow"><h3>Aktuelle Angebote online.</h3><p>GitHub prüft die Quellen regelmäßig. Die Liste bleibt nur auf deinem Handy.</p></div>${icon('refresh')}</div><button class="text-button" data-action="sources">Datenquellen prüfen ${icon('arrow')}</button></div></aside>`; }
  function listPage() {
    const s = state(), shown = s.items.filter(i => !i.deleted && (!ui.hideDone || !i.checked));
    const total = s.items.filter(i => !i.deleted).length, done = s.items.filter(i => !i.deleted && i.checked).length;
    const planned=new Map((getPlan().lines||[]).filter(Boolean).map(l=>[l.item.id,l]));
    return `<section class="hero"><div><div class="eyebrow">Deine Liste. Deine Auswahl.</div><h1>Gute Angebote.<br>Ein guter Plan.</h1><p>Schreib auf, was du brauchst.<br class="mobile-only"> Wir finden passende Angebote dazu.</p></div><div class="hero-art" aria-hidden="true"><div class="art-circle"></div><div class="art-bag">${icon('leaf')}</div><div class="art-tag one">%</div><div class="art-tag two">Clever eingekauft.</div><div class="art-star">✦</div></div></section>${dataBanner()}<div class="split-layout"><section>${searchMarkup()}<div class="section-head"><h2>Deine Einkaufsliste <span class="count-badge">${activeItems().length}</span></h2><button class="text-button" data-action="share-list">${icon('share')} Liste teilen</button></div><div class="choice-toolbar">${activeItems().length?`<button class="secondary" data-action="all-cheapest">${icon('sparkle')} Für alle günstigste passende wählen</button><p class="tiny muted">Angebote und geprüfte Normalpreise. Du kannst die Auswahl je Produkt zurückstellen.</p>`:''}</div><div class="list-card">${shown.length ? shown.map(i=>itemRow(i,planned.get(i.id))).join('') : `<div class="empty-state"><div class="empty-icon">${icon('bag')}</div><h3>${total ? 'Alles abgehakt. Gut eingekauft!' : 'Was brauchst du für deinen Einkauf?'}</h3><p>${total ? 'Neue Produkte kannst du jederzeit über die Suche hinzufügen.' : 'Starte mit einem Produkt. Deine Liste bleibt auf diesem Gerät gespeichert.'}</p><div class="quick-products">${['butter','milch','nudeln'].map(product).filter(Boolean).map(p => {const id=p.id;return `<button class="quick-product" data-action="add-product" data-id="${id}">${thumb(p)}<span>${esc(p.title)} ${icon('plus')}</span></button>`}).join('')}</div><button class="text-button" data-action="sample">${icon('sparkle')} Mit passenden Preisen ausprobieren</button></div>`}</div><div class="list-footer"><span>${total ? `${done} von ${total} Positionen erledigt` : 'Deine Liste. Auch ohne Anmeldung.'}</span>${done ? `<button class="text-button" data-action="toggle-done">${ui.hideDone ? 'Erledigte zeigen' : 'Erledigte ausblenden'}</button>` : '<span>Fotos, sonst Symbolbilder</span>'}</div><button class="primary list-plan-button" data-action="tab" data-tab="plan"><span>Einkauf planen <span class="small">· ${s.settings.maxStores===1?'max. 1 Laden':'max. '+s.settings.maxStores+' Läden'}</span></span>${icon('arrow')}</button><p class="small muted mobile-only" style="margin-top:10px;text-align:center;font-size:10px">Ohne Kundenkarten und App-Angebote.</p></section>${plannerAside()}</div>`;
  }
  function offerCard(o) {
    const p = product(o.productId) || {title:o.title,emoji:'🛒'}, s = store(o.storeId);
    return `<article class="offer-card"><div class="row between"><span class="row">${badge(s)}<strong class="tiny">${esc(s?.name)}</strong></span><span class="source-tag ${o.verification === 'household' ? 'own' : ''}">${priceKind(o)}</span></div>${thumb(p)}<h3>${esc(o.title)}</h3><p class="tiny muted">${E.packLabel(o.pack)}</p>${o.packUnconfirmed?'<p class="small muted">Packung beim Händler prüfen · noch nicht im Preisplan</p>':''}<div class="row" style="margin-top:11px;align-items:baseline"><strong class="offer-price">${E.money(o.priceCents)}</strong>${o.referencePriceCents ? `<span class="old-price">${E.money(o.referencePriceCents)}</span>` : ''}</div><p class="tiny muted" style="margin-top:5px">${E.unitPrice(o)}${o.depositCents ? ` · + ${E.money(o.depositCents)} Pfand` : ''}</p><div class="card-bottom"><p class="date">${o.end ? `${E.shortDate(o.start)}–${E.shortDate(o.end)}` : `Ab ${E.shortDate(o.start)} · Ende offen`}</p><div class="source"><a href="${esc(safeUrl(o.sourceUrl))}" target="_blank" rel="noopener noreferrer">Quelle ↗</a>${o.verification === 'household' ? `<button data-action="remove-offer" data-id="${esc(o.id)}" aria-label="Eigenes Angebot löschen">${icon('trash')}</button>` : '<span>Ohne Karte</span>'}</div><button class="secondary wide" data-action="add-product" data-id="${esc(o.productId)}">${icon('plus')} Auf die Liste</button></div></article>`;
  }
  const normalize = S.normalize;
  function productSubtitle(p) {
    if(p.assortmentStoreId)return `Quelle: ${store(p.assortmentStoreId)?.name || p.assortmentStoreId} · ${E.packLabel(p.pack)}${p.groupSelection?' · Sortenauswahl':''}`;
    const subtitle = p.subtitle || '', pack = p.pack ? E.packLabel(p.pack) : '';
    return pack && !normalize(subtitle).includes(normalize(pack)) ? [subtitle, pack].filter(Boolean).join(' · ') : subtitle;
  }
  function offerResults() {
    const s = state(), terms = normalize(ui.offerQuery).split(' ').filter(Boolean);
    return offers().filter(o => o.priceKind!=='regular' && s.settings.enabledStores.includes(o.storeId) && (ui.offerStore === 'all' || o.storeId === ui.offerStore) && E.overlapsWeek(o, weekStart()) && E.offerUsable(o, Math.max(1,o.minQty || 1)) && terms.every(t => normalize(o.title + ' ' + E.packLabel(o.pack) + ' ' + (product(o.productId)?.keywords || '')).includes(t))).sort((a,b) => a.storeId.localeCompare(b.storeId) || a.title.localeCompare(b.title));
  }
  function offerGroups(found) {
    // Shared product categories, independent of any market's edited walking route.
    return Shopping.group(found.map(offer => {
      const p = product(offer.productId) || {};
      return { offer, product: { ...p, title: offer.title || p.title, name: offer.title || p.title, category: offer.category || p.category, brand: offer.brand || p.brand } };
    }));
  }
  function offerResultsMarkup(found) {
    return offerGroups(found).map(({area,entries}) => `<section class="offer-category" aria-labelledby="offer-category-${esc(area.id)}"><div class="section-head"><h2 id="offer-category-${esc(area.id)}">${esc(area.label)} <span class="count-badge">${entries.length}</span></h2></div><div class="offer-grid">${entries.map(entry=>offerCard(entry.offer)).join('')}</div></section>`).join('');
  }
  function offersPage() {
    const enabled = state().settings.enabledStores;
    if (ui.offerStore !== 'all' && !enabled.includes(ui.offerStore)) ui.offerStore = 'all';
    const found = offerResults();
    return `<div class="page-heading"><div><div class="eyebrow">Entdecken & ergänzen</div><h1>Angebote deiner Märkte.</h1><p>Erfasste Angebote für deine ausgewählten Geschäfte.</p></div><button class="secondary" data-action="add-offer">${icon('plus')} Angebot ergänzen</button></div>${dataBanner()}${weekSwitch()}<div class="offer-toolbar"><input id="offer-search" type="search" aria-label="Angebote durchsuchen" placeholder="Angebote filtern …" value="${esc(ui.offerQuery)}">${storePicker('offer-store',C.stores.filter(s=>enabled.includes(s.id)),ui.offerStore,'Alle ausgewählten Geschäfte')}</div><div class="section-head"><h3 id="offer-count" aria-live="polite">${found.length} Angebote erfasst</h3><button class="text-button" data-action="sources">Datenabdeckung ${icon('info')}</button></div><div class="offer-categories" id="offer-results">${offerResultsMarkup(found)}</div><div id="offer-empty" class="no-results" ${found.length ? 'hidden' : ''}>${icon('tag','big')}<h3 style="margin-top:12px">${hasSelectedStores()?'Hier fehlen noch Angebotsdaten.':'Noch keine Märkte gewählt.'}</h3><p style="margin-top:9px">${hasSelectedStores()?'Kein Treffer bedeutet nicht, dass es keine Angebote gibt.':'Wähle zuerst Märkte aus, deren Angebote du sehen möchtest.'}</p><button class="secondary" style="margin-top:18px" data-action="add-offer">${icon('plus')} Bestätigtes Angebot ergänzen</button></div><div class="help-inline">${icon('shield')} Angezeigt werden nur Preise ohne Karten, App-Coupons und Bonus-Gutschriften. Bilder einer Produktgruppe sind Beispiele, keine Bestätigung aller Sorten.</div>`;
  }
  function brandOptions(){return {engine:E,weekStart:weekStart(),storeIds:state().settings.enabledStores,storeId:ui.brandStore};}
  function brandResults(){return S.brandOffers(searchIndex,offers().filter(o=>o.priceKind!=='regular'),ui.brandQuery,brandOptions());}
  function brandChoices(){return S.brandSuggestions(searchIndex,offers().filter(o=>o.priceKind!=='regular'),ui.brandQuery,brandOptions());}
  function brandEmpty(){return !hasSelectedStores()?'Wähle zuerst Märkte aus, um deren Markenangebote zu sehen.':ui.brandQuery.trim()?'Für diese Marke fehlen hier bestätigte Angebote in der ausgewählten Woche.':'Gib eine Marke ein oder wähle einen Vorschlag. Auch Marken ohne Wochenangebote werden vorgeschlagen.';}
  function brandResultsMarkup(){const found=brandResults();return `<div class="section-head"><h2 id="brand-count" aria-live="polite">${found.length} Markenangebote erfasst</h2><button class="text-button" data-action="sources">Quellen prüfen ${icon('info')}</button></div><div id="brand-empty" class="notice" ${found.length?'hidden':''}><p id="brand-empty-message">${esc(brandEmpty())}</p><p>Kein Treffer bedeutet nicht, dass die Marke nirgends im Angebot ist. Die Händlerabdeckung ist unvollständig.</p></div><div class="offer-grid" id="brand-results">${found.map(offerCard).join('')}</div>`;}
  function brandsPage(){
    const enabled=state().settings.enabledStores;
    if(ui.brandStore!=='all'&&!enabled.includes(ui.brandStore))ui.brandStore='all';
    return `<div class="page-heading"><div><div class="eyebrow">Deine Marken · deine Woche</div><h1>Markenangebote suchen.</h1><p>Marke auswählen, Woche prüfen und erfasste Angebote mit Geschäft und Preis sehen.</p></div></div>${dataBanner()}${weekSwitch()}<div class="offer-toolbar brand-toolbar"><div class="brand-input-wrap"><label class="field-label" for="brand-search">Welche Marke suchst du?</label><input id="brand-search" type="search" role="combobox" aria-label="Marke suchen" aria-autocomplete="list" aria-expanded="${ui.brandOpen}" aria-controls="brand-suggestions" autocomplete="off" placeholder="Markennamen eingeben …" value="${esc(ui.brandQuery)}"><div id="brand-suggestions" class="brand-dropdown" role="listbox" aria-label="Markenvorschläge" hidden></div></div><div class="brand-shop-label"><span class="field-label">Geschäft</span>${storePicker('brand-store',C.stores.filter(s=>enabled.includes(s.id)),ui.brandStore,'Alle aktiven Geschäfte')}</div></div><p class="small muted brand-help">Vorschläge kommen aus dem gesamten bekannten Sortiment. Die Zahl daneben gilt nur für die gewählte Woche und deine aktiven Geschäfte.</p><div id="brand-content">${brandResultsMarkup()}</div><div class="help-inline">${icon('info')} Ein Gruppenangebot bestätigt nur die angegebenen Größen und Sorten. Verfügbarkeit in der Filiale ist nicht bestätigt.</div><button class="secondary" data-action="tab" data-tab="stores">${icon('pin')} Märkte auswählen</button>`;
  }
  function renderBrandSuggestions(){
    const box=$('brand-suggestions');if(!box)return;
    $('brand-search').setAttribute('aria-expanded',String(ui.brandOpen));box.hidden=!ui.brandOpen;
    if(!ui.brandOpen)return;
    const choices=brandChoices();
    box.innerHTML=choices.length?choices.map((b,i)=>`<button role="option" id="brand-option-${i}" aria-selected="${ui.brandSelected===i}" data-action="brand-query" data-brand="${esc(b.name)}"><strong>${esc(b.name)}</strong><span>${b.count?`${b.count} erfasste Angebote`:'Noch kein Wochenangebot erfasst'}</span></button>`).join(''):'<p>Keine bekannte Marke mit diesem Namen gefunden. Du kannst den Namen trotzdem suchen.</p>';
    if(ui.brandSelected>=0)$('brand-search').setAttribute('aria-activedescendant',`brand-option-${ui.brandSelected}`);else $('brand-search').removeAttribute('aria-activedescendant');
  }
  function selectBrand(name){ui.brandQuery=name;ui.brandOpen=false;ui.brandSelected=-1;$('brand-search').value=name;updateBrandResults();$('brand-search').focus({preventScroll:true});ui.brandOpen=false;renderBrandSuggestions();}
  function updateBrandResults(){$('brand-content').innerHTML=brandResultsMarkup();renderBrandSuggestions();}
  function assortmentHintMarkup(item){
    const possible=matching(item.product,item.qty).filter(x=>x.match.status==='uncertain');
    const priceHints=possible.length?`<div class="assortment-hints"><strong class="small">Mögliches Angebot – Packung oder Sorte noch offen</strong>${possible.map(x=>`<div class="assortment-hint">${badge(store(x.offer.storeId))}<div><strong>${esc(store(x.offer.storeId)?.name)} · ${E.money(x.offer.priceCents)}</strong><p>${esc(x.offer.title)} · ${priceKind(x.offer)}</p><p class="tiny muted">${esc(x.match.reasons.join('. '))}. Deshalb noch nicht in der Summe enthalten.</p><a class="text-button" href="${esc(safeUrl(x.offer.sourceUrl))}" target="_blank" rel="noopener noreferrer">Angebot beim Händler ansehen ↗</a></div></div>`).join('')}</div>`:'';
    const hints=S.assortmentHints(item.product,assortment.products,{engine:E,storeIds:state().settings.enabledStores});
    if(!hints.length)return priceHints||`<p class="tiny muted">Auch kein passender Sortimentsnachweis erfasst. <button class="text-button" data-action="tab" data-tab="stores">Geschäfte und Quellen ansehen</button></p>`;
    return priceHints+`<div class="assortment-hints"><strong class="small">Händlerhinweis aus dem Sortiment</strong>${hints.map(h=>{const st=store(h.storeId),p=h.products[0];return `<div class="assortment-hint">${badge(st)}<div><strong>${esc(st?.name||h.storeId)}</strong><p>${esc(p.title)} · ${E.packLabel(p.pack)}</p><p class="tiny muted">Produkt online gelistet · geprüft ${esc(p.assortmentCheckedAt)}. Preis, Wochenangebot und Filialbestand offen.</p><a class="text-button" href="${esc(safeUrl(p.assortmentSourceUrl))}" target="_blank" rel="noopener noreferrer">Produkt beim Händler prüfen ↗</a></div></div>`;}).join('')}</div>`;
  }
  function storeRows(){
    const query=normalize(ui.storeQuery),enabled=state().settings.enabledStores;
    return C.stores.filter(st=>normalize(st.name).includes(query)).map(st=>{
      const count=offers().filter(o=>o.storeId===st.id&&E.overlapsWeek(o,weekStart())&&E.offerUsable(o,Math.max(1,o.minQty||1))).length,src=sourceStatusFor(st);
      return `<article class="store-directory-card"><div class="row">${badge(st)}<div class="grow"><h2>${esc(st.name)}</h2><p></p></div><label class="store-enable"><input type="checkbox" aria-label="${esc(st.name)} einplanen" class="store-toggle" data-store="${st.id}" ${enabled.includes(st.id)?'checked':''}> Einplanen</label></div><p class="small">${esc(st.type||'Lebensmittelgeschäft')} · Filiale ${st.verifiedAt?'geprüft am '+esc(st.verifiedAt):'noch nicht aktuell geprüft'}</p>${st.temporaryClosureUntil&&st.temporaryClosureUntil>=E.berlinToday()?`<p class="notice">Vorübergehend geschlossen bis einschließlich ${E.shortDate(st.temporaryClosureUntil)} – wird in diesem Zeitraum nicht eingeplant.</p>`:''}<p class="small"><strong>${count} erfasste Preise ${weekName().toLowerCase()}</strong></p><p class="tiny muted">${esc(src?.message||'Noch kein automatischer Angebotsabruf eingerichtet. Filiale bekannt; Angebotspreise und Bestand nicht bestätigt.')}</p><div class="row"><a class="text-button" href="${esc(storeUrl(st.url))}" target="_blank" rel="noopener noreferrer">Angebote prüfen ↗</a></div></article>`;
    }).join('')||'<p class="notice">Kein erfasstes Geschäft passt zu dieser Suche.</p>';
  }
  function storesWithPrices() {
    const days=E.daysOfWeek(weekStart()).filter(day=>day>=E.berlinToday());
    return C.stores.filter(st=>offers().some(o=>o.storeId===st.id&&E.offerUsable(o,Math.max(1,o.minQty||1))&&days.some(day=>E.validOn(o,day)&&E.storeOpenOn(st,day)))).map(st=>st.id);
  }
  function leafletsPage(){
    const enabled=state().settings.enabledStores,today=E.berlinToday();
    const shown=window.SparnahLeaflets.select(leafletData,C.stores,enabled,{today,mode:ui.leafletMode,engine:E});
    const represented=new Set(shown.flatMap(p=>p.stores.map(s=>s.id)));
    const missing=C.stores.filter(s=>enabled.includes(s.id)&&!represented.has(s.id));
    return `<div class="page-heading"><div><div class="eyebrow">Deine ausgewählten Märkte</div><h1>Aktuelle Prospekte.</h1><p>Durchblättern, Angebote entdecken und deinen Einkauf planen.</p></div><button class="secondary" data-action="refresh-leaflets">${icon('refresh')} Aktualisieren</button></div><div class="week-switch" aria-label="Prospektzeitraum"><button class="chip ${ui.leafletMode==='today'?'selected':''}" aria-pressed="${ui.leafletMode==='today'}" data-action="leaflet-mode" data-mode="today">Heute gültig</button><button class="chip ${ui.leafletMode==='week'?'selected':''}" aria-pressed="${ui.leafletMode==='week'}" data-action="leaflet-mode" data-mode="week">Diese Woche gültig</button><span class="tiny muted">${ui.leafletMode==='today'?E.shortDate(today):E.shortDate(E.mondayOf(today))+' – '+E.shortDate(E.addDays(E.mondayOf(today),6))}</span></div><p class="small muted leaflet-intro">Nur Prospekte mit geprüftem Gültigkeitszeitraum. Abgelaufene Prospekte werden automatisch ausgeblendet.${ui.leafletMode==='week'?' Enthält auch Prospekte, die später in dieser Woche beginnen.':''}</p>${leafletError?`<p class="notice">${esc(leafletError)}</p>`:''}<div class="leaflet-grid">${shown.map(p=>`<article class="leaflet-card"><div class="row">${badge(p.stores[0])}<div><h2>${esc(p.title)}</h2><p class="small muted">${esc(p.stores.map(s=>s.name).join(' · '))}</p></div></div><div class="leaflet-dates">${icon('calendar')} ${E.shortDate(p.start)} – ${E.shortDate(p.end)}${p.start>today?' · ab '+E.shortDate(p.start):' · heute gültig'}</div><p class="small">Nur für den hinterlegten Markt gültige Prospekte.</p><a class="primary leaflet-open" href="${esc(safeUrl(p.viewerUrl))}" target="_blank" rel="noopener noreferrer">Prospekt ansehen ${icon('external')}</a><p class="tiny muted">Öffnet den offiziellen Prospekt. Geprüft am ${esc(p.checkedAt.slice(0,10))}.</p></article>`).join('')}</div>${!shown.length?`<div class="notice">${!leafletLoaded?'Prospekte werden geladen …':!enabled.length?'Wähle unter „Läden“ mindestens einen Markt aus.':'Für deine Auswahl ist derzeit kein passender Prospekt mit bestätigtem Zeitraum verfügbar.'}</div>`:''}${missing.length?`<details class="method"><summary>Für ${missing.length} ausgewählte Märkte fehlt ein passender geprüfter Prospekt</summary><p>${esc(missing.map(s=>s.name).join(' · '))}</p><p>Diese Märkte bleiben in deiner Auswahl. Unbestätigte oder abgelaufene Prospekte erscheinen hier nicht.</p></details>`:''}<button class="text-button" data-action="tab" data-tab="stores">${icon('pin')} Ausgewählte Märkte ändern</button>`;
  }
  async function refreshLeaflets(){return refreshPrivateData(true);}
  function storesPage(){
    const selected=state().settings.enabledStores, priced=storesWithPrices();
    return `<div class="page-heading"><div><div class="eyebrow">Deine Märkte</div><h1>Märkte auswählen.</h1><p>${selected.length} ausgewählt · ${C.stores.length} Händler im freigegebenen Katalog.</p></div><button class="primary" data-action="tab" data-tab="list">Zur Einkaufsliste ${icon('arrow')}</button></div><section class="settings-card"><h2>Schnell starten</h2><p>Wähle mit einem Klick die Märkte mit nutzbaren Preisen für ${ui.weekMode==='next'?'nächste Woche':'diese Woche'}. Danach kannst du jeden Laden einzeln ändern. Deine Auswahl bleibt auf diesem Gerät.</p><div class="row" style="flex-wrap:wrap;margin-top:14px"><button class="secondary" data-action="select-priced-stores" ${priced.length?'':'disabled'}>Märkte mit Preisen wählen (${priced.length})</button><button class="text-button" data-action="clear-stores" ${selected.length?'':'disabled'}>Auswahl leeren</button></div><p class="tiny muted" style="margin-top:10px">Es werden nur erfasste Preise verglichen. Eine bekannte Filiale ist kein Nachweis für ein vollständiges Sortiment oder vorhandene Ware.</p></section>${weekSwitch()}<div class="offer-toolbar"><input id="store-search" type="search" aria-label="Geschäfte suchen" placeholder="Händler suchen …" value="${esc(ui.storeQuery)}"></div><div class="store-directory" id="store-directory">${storeRows()}</div>`;
  }
  function unitSavingMarkup(line) {
    if(!line?.unitSaving)return '';
    const comparison=line.unitSaving;
    const percent=new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(comparison.percent);
    return `<p class="pack-change"><strong>${esc(E.unitPrice(line.offer))} statt ${esc(E.unitPrice(comparison.originalOffer))} · ${percent} % günstiger</strong><br><span class="tiny">Gegenüber deiner ursprünglichen Auswahl im selben Laden am Einkaufstag. <a href="${esc(safeUrl(comparison.originalOffer.sourceUrl))}" target="_blank" rel="noopener noreferrer">Vergleichspreis ↗</a></span></p>`;
  }
  function pricedLine(line) {
    const selected=selectedProduct(line), wish=line.item.requestedProduct||line.item.product;
    return `<div class="visit-line">${thumb(selected.product,'',true)}<div class="grow"><strong class="small">${line.item.qty} × ${esc(selected.title)}</strong>${selected.title!==wish.title?`<p class="tiny muted">Für: ${esc(wish.title)}</p>`:''}<p class="tiny muted">${E.packLabel(line.offer.pack)} · ${esc(E.unitPrice(line.offer))} · <span class="price-kind">${priceKind(line.offer)}</span>${line.item.choiceMode==='cheapest'?' · Günstigste passende Auswahl':''}</p>${packChange(line)?`<p class="pack-change"><strong>${esc(packChange(line))}</strong></p>`:''}${unitSavingMarkup(line)}${selected.label?`<p class="tiny muted">${esc(selected.label)}</p>`:''}<a class="tiny" href="${esc(safeUrl(line.offer.sourceUrl))}" target="_blank" rel="noopener noreferrer">Preisquelle ↗</a>${line.offer.priceKind==='regular'?`<p class="tiny muted">Geprüft am ${E.shortDate(line.offer.start)} · ${line.offer.catalogNormalPriceSource?'Online-Katalogpreis; Filialpreis und Bestand vor Ort offen':'Bestand vor Ort offen'}</p>`:!line.offer.end?'<p class="tiny muted">Ende offen: nur am angekündigten Starttag eingeplant.</p>':''}</div><span class="price">${E.money(line.cost)}</span></div>`;
  }
  function unpricedLine(u,assigned=false) {
    const wish=u.item.requestedProduct||u.item.product;
    return `<div class="${assigned?'visit-line unpriced-line':'unknown-line'}">${thumb(wish)}<div class="grow"><strong class="small">${u.item.qty} × ${esc(wish.title)}</strong><p class="small muted">${assigned?'Hier mitkaufen · Preis noch offen. Verfügbarkeit nicht bestätigt.':esc(u.reason)}</p>${estimateMarkup(u.item)}<details class="unpriced-details"><summary>Details und mögliche Preise</summary>${assortmentHintMarkup(u.item)}<button class="text-button" data-action="product" data-id="${esc(u.item.id)}">Alle erfassten Preise ansehen</button></details></div><span class="price-open">${estimated(u.item)?'Händlerpreis offen':'Preis offen'}</span></div>`;
  }
  function estimated(item) {
    return hasSelectedStores()?priceGuide?.estimate(item.requestedProduct||item.product,item.qty,E.berlinToday()):null;
  }
  function estimateMarkup(item) {
    const e=estimated(item);if(!e)return '';
    const unit=e.pack.unit==='g'?'kg':e.pack.unit==='ml'?'l':e.pack.unit;
    const base=['g','ml'].includes(e.pack.unit)?1000:1;
    const unitText=e.assumedRange?'':` · ca. ${E.money(Math.round(e.cents*base/e.pack.min))}/${esc(unit)}`;
    return `<div class="estimated-price"><strong>Geschätzt: ca. ${E.money(e.total)}${e.stale?' · Richtwert veraltet':''}</strong>${e.basis==='category'?'<p class="tiny"><strong>Grobe Schätzung aus ähnlichen Preisbeispielen.</strong></p>':e.basis==='similar'?'<p class="tiny">Aus einem ähnlichen Produkt geschätzt.</p>':''}<p class="tiny">${item.qty} × ca. ${E.money(e.cents)} · ${e.assumedPack||e.assumedRange?'Angenommene Packung: ':''}${esc(E.packLabel(e.pack))}${e.scaled?' · nach Packungsgröße umgerechnet':''}${unitText}</p>${e.assumptionNote?`<p class="tiny"><strong>${esc(e.assumptionNote)}</strong></p>`:''}<p class="tiny">Richtwert, kein bestätigter Preis deines Ladens. Ohne Pfand.</p><details><summary class="tiny">Grundlage und Prüfdatum</summary><p class="tiny">${esc(e.explanation||'Passendes Preisbeispiel als Budgethilfe.')} Preisbeispiel: ${esc(e.label)} · ${E.money(e.referenceCents)} für ${esc(E.packLabel(e.referencePack))}. Quelle geprüft am ${e.reviewedAt.split('-').reverse().join('.')}. ${e.stale?'Überprüfung fällig – Richtwert veraltet.':'Nächste Prüfung vorgesehen: '+e.reviewDue.split('-').reverse().join('.')+'.'} Kein Markt-Durchschnitt; regionale Preise können abweichen.</p><a class="tiny" href="${esc(safeUrl(e.sourceUrl))}" target="_blank" rel="noopener noreferrer">${esc(e.sourceLabel||'Preisgrundlage')} ↗</a>${e.packSourceUrl?` · <a class="tiny" href="${esc(safeUrl(e.packSourceUrl))}" target="_blank" rel="noopener noreferrer">Packungsgrößen-Beispiel ↗</a>`:''}</details></div>`;
  }
  function planSummary(p) {
    const s=priceGuide?.summarize(p.unknown,E.berlinToday()),hasEstimate=!!s?.count;
    const title=hasEstimate?(s.remaining?'Geschätzte Teilsumme':'Geschätztes Einkaufsbudget'):p.coverage?(p.complete?'Gesamtpreis':'Bekannte Zwischensumme'):'Preis offen';
    const amount=hasEstimate?`ca. ${E.money(p.total+s.total)}`:p.coverage?E.money(p.total):'–';
    const comparison=p.cheaperAlternativeCount?`${p.cheaperAlternativeCount} ${p.cheaperAlternativeCount===1?'günstigere Alternative':'günstigere Alternativen'}`:`${p.coverage} ${p.coverage===1?'Preis berücksichtigt':'Preise berücksichtigt'}`;
    return `<section class="plan-overview" aria-label="Einkaufssumme"><div class="overview-main"><h2>${title}</h2><strong class="overview-amount ${hasEstimate?'is-estimated':''}">${amount}</strong></div>${hasEstimate?`<p class="overview-breakdown"><span>${E.money(p.total)} belegte Preise${p.coverage?' · Bekannte Zwischensumme':''}</span><span class="estimate-part">+ ca. ${E.money(s.total)} geschätzt</span></p>`:''}<p class="overview-status">${p.complete?`${p.count} Positionen mit Preis`:`${p.unknown.length} ${p.unknown.length===1?'Preis':'Preise'} noch offen`}${hasEstimate&&s.remaining?` · ${s.remaining} ${s.remaining===1?'Position':'Positionen'} ohne Richtwert – fehlt in der Summe`:''}${hasEstimate?' · ohne Pfand':''}${p.deposit?` · + ${E.money(p.deposit)} bekanntes Pfand`:''}</p><details class="overview-details"><summary>${comparison} · Details</summary><p>${p.cheaperAlternativeCount?'Weniger pro Kilo oder Liter. Den Vergleich siehst du direkt am Produkt.':'Normalpreise und Angebote zählen im Plan. Ein günstiger Preis braucht keinen Sonderrabatt.'}</p><p>${p.referenceSavings>0?`Zusätzlich ausgewiesene Händler-Rabatte: ${E.money(p.referenceSavings)} gegenüber den Händler-Vergleichspreisen für ${p.referenceCount} Positionen. Nicht zur Ersparnis durch Produktwechsel addieren.`:'Kein Händler-Rabatt mit höherem Vergleichspreis erfasst.'}</p>${hasEstimate?'<p>Schätzwerte beeinflussen weder Ladenwahl noch Rabattberechnung. Sie bestätigen keine Händlerpreise.</p>':''}<p>${p.visits.length} ${p.visits.length===1?'Geschäft':'Geschäfte'} · ${p.dayCount} ${p.dayCount===1?'Einkaufstag':'Einkaufstage'}${p.complete?'':' · kein vollständiger Gesamtpreis'}</p></details></section>`;
  }
  function estimateGuide() {
    const guide=window.SparnahEstimates;if(!priceGuide)return '';
    return `<section class="settings-card"><h2>Richtpreisliste</h2><p>${priceGuide.entries.length.toLocaleString('de-DE')} datierte Preisbeispiele · Stand ${guide.reviewedAt.split('-').reverse().join('.')}. Nächste Prüfung vorgesehen: ${guide.reviewDue.split('-').reverse().join('.')}${E.berlinToday()>=guide.reviewDue?' · Überprüfung fällig':''}.</p><p>Fehlt ein Händlerpreis, erhält das Produkt einen gelben Schätzpreis: zuerst aus einem passenden Preisbeispiel, sonst aus ähnlichen Produkten oder als grobe Kategorie-Schätzung. Angenommene Packungsgrößen werden angezeigt. Unklare Artikel ohne brauchbare Grundlage bleiben ausdrücklich offen.</p><p>Diese Budgethilfe bestätigt weder den Preis noch die Verfügbarkeit bei deinen ausgewählten Läden. Die Richtpreisliste wird mit einem App-Update erneuert, wenn du die Aktualisierung beauftragst.</p><details><summary>Preisliste und Quellen durchsuchen</summary><label class="form-field">Produkt oder Marke<input id="estimate-search" type="search" value="${esc(guideQuery)}" placeholder="z. B. Soba, Milch, Kaffee"></label><div id="estimate-results">${estimateGuideRows()}</div></details></section>`;
  }
  function estimateGuideRows() {
    const q=S.normalize(guideQuery),rows=priceGuide.entries.filter(e=>!q||S.normalize(e.label+' '+(e.brand||'')).includes(q));
    return `<p class="tiny">${rows.length.toLocaleString('de-DE')} Preisbeispiele${rows.length>60?' · erste 60 angezeigt, bitte Suche eingrenzen':''}</p><div class="guide-table"><table><thead><tr><th>Preisbeispiel</th><th>Packung</th><th>Basispreis</th></tr></thead><tbody>${rows.slice(0,60).map(e=>`<tr><td><a href="${esc(safeUrl(e.sourceUrl))}" target="_blank" rel="noopener noreferrer">${esc(e.label)}</a>${e.note?`<p class="tiny muted">${esc(e.note)}</p>`:''}</td><td>${esc(E.packLabel(e.pack))}</td><td>${E.money(e.cents)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function estimateText(item) {
    const e=estimated(item);
    return e?`Geschätzt ca. ${E.money(e.total)} (${item.qty} × ca. ${E.money(e.cents)}, ${e.assumedPack||e.assumedRange?'angenommene Packung ':''}${E.packLabel(e.pack)}; ${e.basis==='category'?'grobe Kategorie-Schätzung; ':e.basis==='similar'?'ähnliches Produkt; ':''}${e.assumptionNote?e.assumptionNote+'; ':''}Richtwert vom ${e.reviewedAt}${e.stale?', veraltet':''}; ohne Pfand, kein bestätigter Händlerpreis)`:'Preis offen – keine brauchbare Schätzgrundlage';
  }
  function destinationSelector(settings) {
    const selected=C.stores.filter(st=>settings.enabledStores.includes(st.id));
    const target=selected.some(st=>st.id===settings.targetStoreId)?settings.targetStoreId:'';
    return `<div class="destination-picker"><strong>Wo möchtest du einkaufen?</strong>${storePicker('plan-destination',selected,target,'Automatisch vergleichen ('+selected.length+' ausgewählte Märkte)','','Einkaufsladen')}<p class="tiny muted">${target?'Die ganze Liste wird diesem Laden zugeordnet. Fehlende Preise bleiben offen; der Bestand ist nicht bestätigt.':'„Maximal 1 Laden“ begrenzt die Tour. Wähle hier einen bestimmten Laden, wenn du dort auch Produkte ohne bekannten Preis mitkaufen möchtest.'}</p></div>`;
  }
  function planPage() {
    const p=getPlan(), settings=state().settings;
    const heading=`<div class="page-heading compact-plan-heading"><div><h1>${p.empty?'Dein Sparplan':'Hier kaufst du ein.'}</h1><p>${weekText()}</p></div><button class="secondary" data-action="recalculate" aria-label="Sparplan neu berechnen">${icon('refresh')} Neu berechnen</button></div>`;
    if(!hasSelectedStores())return heading+`<div class="list-card empty-state"><h3>Dein Plan wartet auf deine Marktauswahl.</h3><p>Deine Einkaufsliste bleibt erhalten. Sobald du Märkte auswählst, werden passende Preise verglichen.</p><button class="secondary" data-action="tab" data-tab="list">Zur Einkaufsliste ${icon('arrow')}</button></div>`;
    if(p.empty)return heading+`<div class="list-card empty-state"><div class="empty-icon">${icon('route')}</div><h3>Was möchtest du einkaufen?</h3><p>Füge zuerst Produkte hinzu. Abgehakte Produkte werden nicht erneut eingeplant.</p><button class="primary" data-action="tab" data-tab="list">Zur Einkaufsliste ${icon('arrow')}</button></div>`;
    const unassigned=p.unknown.filter(u=>!u.assignedStoreId), allInOne=p.visits.length===1&&!unassigned.length;
    const comparisonNote=p.unitComparisons?'<p class="notice">Markenalternativen werden nach Kilo- oder Literpreis verglichen, bei unterschiedlicher Packungsgröße auf die ursprüngliche Menge umgerechnet. Die Summe zeigt den tatsächlichen Kassenbetrag für die eingeplanten Packungen; sie kann bei einer größeren Packung höher sein.</p>':'';
    let html=heading+planSummary(p)+weekSwitch();
    for(const [index,v] of p.visits.entries()){
      const open=v.unpriced||[], count=v.lines.length+open.length;
      const start=`<button class="primary" data-action="start-shopping" data-store="${esc(v.store.id)}" data-day="${esc(v.day)}" aria-label="Einkauf bei ${esc(v.store.name)} am ${esc(E.shortDate(v.day,true))} starten">${icon('bag')} Einkauf starten</button>`;
      html+=`<article class="plan-visit"><header class="visit-head"><span class="visit-number">${index+1}</span>${badge(v.store)}<div class="grow"><h3>${esc(v.store.name)}</h3><div class="day">${E.shortDate(v.day,true)} · ${count} Position${count===1?'':'en'}</div></div><div class="total">${v.lines.length?E.money(v.total):'Preis offen'}${open.length?'<small>Gesamtsumme offen</small>':''}</div></header><div class="visit-start-top">${start}</div>${v.lines.map(pricedLine).join('')}${open.map(u=>unpricedLine(u,true)).join('')}<footer class="visit-footer">${start}<button class="text-button" data-action="edit-market" data-store="${esc(v.store.id)}">${icon('settings')} Marktplan vorher anpassen</button><span>${v.deposit?` · + ${E.money(v.deposit)} Pfand`:''}</span></footer></article>`;
    }
    if(unassigned.length)html+=`<section class="unknown-card"><h3>Einkaufsladen noch wählen</h3><p class="small muted">Unter „Einstellungen → Einkaufsplanung“ kannst du diese Produkte einem Laden zuordnen. Die Katalogquelle am Produkt ist keine Ladenwahl. Preise bleiben bis zu einem passenden Nachweis offen.</p>${unassigned.map(u=>unpricedLine(u)).join('')}</section>`;
    html+=`<details class="method plan-data-details"><summary>Datenstand und Planungsdetails</summary>${dataBanner()}${comparisonNote}<p>${p.complete?`Alle ${p.count} Positionen mit Preis eingeplant.`:allInOne?`Deine ganze Einkaufsliste gehört zu diesem Laden. ${p.coverage} von ${p.count} Preisen sind bekannt.`:`${p.coverage} von ${p.count} Positionen mit passendem Preis gefunden.`} ${p.complete?'Verglichen werden die erfassten Angebote und Normalpreise.':'Produkte ohne bestätigten Händlerpreis fehlen in der belegten Summe; passende Richtwerte ergänzen das geschätzte Budget.'}</p><button class="text-button" data-action="tab" data-tab="settings">${icon('settings')} Einkaufsplanung in den Einstellungen ändern</button></details>`;
    html+=`<div class="help-inline">${icon('info')} ${p.complete?'Günstigste Kombination nach dem beschriebenen Preisvergleich und deinen Einstellungen. Unbekannte Händlerpreise und Fahrtkosten sind nicht enthalten.':p.coverage?'Die Ladenwahl richtet sich nach den bekannten Preisen. Der günstigste vollständige Einkauf ist erst vergleichbar, wenn alle Preise bekannt sind.':p.visits.length?'Dieser Laden wurde aus deiner Auswahl übernommen. Ohne passende Preise kann kein günstigster Einkauf ermittelt werden.':'Wähle einen einzelnen Laden, um dort die ganze Liste mitzunehmen. Ohne passende Preise kann kein günstigster Laden ermittelt werden.'}</div><div class="plan-actions"><button class="secondary" data-action="tab" data-tab="list">Produktauswahl ändern</button><button class="secondary" data-action="share-plan">${icon('share')} Plan teilen</button><button class="secondary" data-action="print">${icon('print')} Drucken</button><button class="secondary" data-action="add-offer">${icon('plus')} Preis ergänzen</button></div><details class="method"><summary>So wird dieser Plan berechnet</summary><p>Verglichen werden erfasste Angebote und geprüfte Normalpreise an den verbleibenden Tagen der ausgewählten Woche, Montag bis Samstag. Tagespreise zählen nur am geprüften Tag. Pro Laden ist höchstens ein Besuch vorgesehen. ${settings.allowSplitDays?'Verschiedene Einkaufstage sind erlaubt.':'Alle Besuche finden am selben Tag statt.'}</p><p>Vorrang hat eine möglichst vollständige Preisabdeckung. Bei gleicher Abdeckung derselben Produkte entscheidet der kleinste Vergleichswert: Markenalternativen werden anhand ihres Kilo- oder Literpreises auf die ursprüngliche Wunschmenge umgerechnet, andere Produkte zum tatsächlichen Preis. Danach entscheiden weniger Geschäfte, weniger Tage und der frühere Termin. Unterschiedliche Teilpläne mit gleich vielen Produkten folgen der Reihenfolge deiner Liste.</p><p>„Meine Auswahl“ behält deinen Produktwunsch. „Günstigstes passendes Produkt“ erlaubt die beim Produkt beschriebenen Alternativen. Bekannte Eigenschaften bleiben erhalten. Bei ausdrücklich beschriebenen Markenalternativen sind bis zu 20 % kleinere oder größere Packungen erlaubt. Die Packungsanzahl bleibt gleich, abweichende Größen werden angezeigt. Unklare Sorten werden nicht als passend berechnet. Keine geschätzten Preise, Kundenkarten, App-Coupons oder automatische Mehrmengen.</p><p>Offene Produkte beim einzigen geplanten Laden sind Einkaufswünsche, keine Bestandsbestätigung. Preise ohne passenden Beleg bleiben aus der Summe. Quellenabdeckung: unvollständig, Stand ${esc(C.observedAt)}. Sonderöffnungszeiten und Verfügbarkeit bitte vor der Fahrt auf der Filialseite prüfen.</p></details>`;
    return html;
  }
  function shoppingSession() {
    const session=model.shoppingSession;
    return session&&store(session.storeId)&&Array.isArray(session.entries)?session:null;
  }
  function marketKey(shop) { return shop.retailerId||shop.id; }
  function marketLayout(shop) { return Shopping.layout(marketKey(shop),model.base.settings.shoppingLayouts?.[marketKey(shop)]); }
  function saveMarketLayout(shop,layout,rerender=true) {
    perform({type:'settings',settings:{shoppingLayouts:{...model.base.settings.shoppingLayouts,[marketKey(shop)]:Shopping.layout(marketKey(shop),layout)}}},rerender);
  }
  function resumeShopping() {
    const session=shoppingSession();
    return session?`<button class="shopping-resume" data-action="tab" data-tab="shopping">${badge(store(session.storeId))}<span><strong>Einkauf fortsetzen</strong><small>Deine Liste in der Reihenfolge deines Marktplans</small></span>${icon('arrow')}</button>`:'';
  }
  function startShopping(storeId,day) {
    const visit=getPlan().visits?.find(v=>v.store.id===storeId&&v.day===day);
    if(!visit)return toast('Der Plan hat sich geändert. Bitte den gewünschten Laden erneut auswählen.');
    const entries=visit.lines.map(line=>{
      const selected=selectedProduct(line);
      return {itemId:line.item.id,product:{...selected.product,title:selected.title},qty:line.item.qty,line};
    }).concat((visit.unpriced||[]).map(unknown=>({itemId:unknown.item.id,product:unknown.item.requestedProduct||unknown.item.product,qty:unknown.item.qty,unknown})));
    model.shoppingSession=clone({storeId:visit.store.id,day:visit.day,entries});
    persist();navigate('shopping');
  }
  function shoppingEntries(session) {
    const current=new Map(model.base.items.filter(i=>!i.deleted).map(i=>[i.id,i]));
    return session.entries.filter(e=>e&&typeof e.itemId==='string'&&e.product&&current.has(e.itemId))
      .map(e=>({...e,qty:current.get(e.itemId).qty,checked:!!current.get(e.itemId).checked}));
  }
  function shoppingEstimate(entry) {
    const e=estimated({product:entry.product,qty:entry.qty});
    if(!e)return '<p class="tiny muted">Preis offen</p>';
    return `<p class="shopping-estimate">Geschätzt ca. ${E.money(e.total)}${e.stale?' · veraltet':''}</p>`;
  }
  function shoppingRow(entry) {
    const line=entry.line;
    const stillListed=line?.offer&&offers().some(o=>o.id===line.offer.id&&o.storeId===line.offer.storeId&&o.priceCents===line.offer.priceCents&&o.title===line.offer.title&&JSON.stringify(o.pack)===JSON.stringify(line.offer.pack)&&E.validOn(o,E.berlinToday())&&E.offerUsable(o,entry.qty));
    const usable=stillListed&&E.validOn(line.offer,E.berlinToday())&&E.offerUsable(line.offer,entry.qty);
    const original=model.base.items.find(i=>i.id===entry.itemId)?.product;
    const price=usable?`<p class="shopping-price">${E.money(line.offer.priceCents*entry.qty)} <span class="tiny">${priceKind(line.offer)} · ${esc(E.unitPrice(line.offer))}${line.offer.depositCents?` · + ${E.money(line.offer.depositCents*entry.qty)} Pfand`:''}</span></p>`:shoppingEstimate(entry);
    return `<article class="shopping-row ${entry.checked?'checked':''}" data-shopping-item="${esc(entry.itemId)}"><button class="shopping-check ${entry.checked?'done':''}" data-action="check" data-id="${esc(entry.itemId)}" role="checkbox" aria-checked="${entry.checked}" aria-label="${esc(entry.product.title)} als ${entry.checked?'offen':'eingekauft'} markieren">${entry.checked?icon('check'):''}</button>${thumb(entry.product,'',true)}<div class="grow"><h3>${entry.qty} × ${esc(entry.product.title)}</h3>${original?.title!==entry.product.title?`<p class="tiny muted">Für: ${esc(original?.title)}</p>`:''}<p class="small muted">${esc(E.packLabel(line?.offer?.pack||entry.product.pack))}</p>${entry.checked?'<p class="shopping-done">Im Einkaufswagen</p>':price}${!usable&&line?'<p class="tiny muted">Der Planpreis ist heute nicht bestätigt.</p>':''}</div></article>`;
  }
  function shoppingPage() {
    const session=shoppingSession();
    if(!session)return `<div class="empty-state"><h1>Dein Einkauf im Markt</h1><p>Starte beim vorgeschlagenen Laden im Sparplan. Deine Liste folgt dann den Bereichen deines Marktplans.</p><button class="primary" data-action="tab" data-tab="plan">Zum Sparplan ${icon('arrow')}</button></div>`;
    const shop=store(session.storeId),layout=marketLayout(shop),entries=shoppingEntries(session),groups=Shopping.group(entries,layout);
    const done=entries.filter(e=>e.checked).length,percent=entries.length?Math.round(done*100/entries.length):100;
    return `<div class="shopping-toolbar"><button class="text-button" data-action="tab" data-tab="plan">← Sparplan</button><span class="tiny muted">Alle Produkte auf einer Liste</span></div><section class="shopping-hero"><div class="row">${badge(shop)}<div><div class="eyebrow">Nur abhaken und scrollen</div><h1>Einkaufen bei ${esc(shop.name)}</h1></div></div><p>Sortiert nach deinem Marktplan · alle Bereiche sind bereits offen.</p><div class="shopping-progress-label"><strong>${done} von ${entries.length} im Wagen</strong><span>${percent} %</span></div><progress value="${done}" max="${entries.length||1}" aria-label="${done} von ${entries.length} Produkten eingekauft"></progress></section><div class="shopping-continuous-list" aria-label="Vollständige Einkaufsliste in Marktreihenfolge">${groups.map(g=>`<section class="shopping-department" style="--area-color:${esc(g.area.color)}"><header><span class="department-symbol" aria-hidden="true">${esc(g.area.icon)}</span><div class="grow"><h2>${esc(g.area.label)}</h2><span class="small muted">${g.entries.filter(e=>!e.checked).length} offen</span></div><span class="department-number">${layout.areas.findIndex(a=>a.id===g.area.id)+1}</span></header>${g.entries.map(shoppingRow).join('')}</section>`).join('')}</div><p class="tiny muted shopping-plan-note">Produkte aus deinem gestarteten Sparplan für ${E.shortDate(session.day,true)} · Preise gelten nur mit passendem Datum; Bestand ist nicht bestätigt. Neue Produkte und Marktänderungen übernimmst du vor dem nächsten Einkauf im Sparplan.</p><div class="shopping-finish"><strong>${done===entries.length?'Alles im Wagen. Gut eingekauft!':'Du kannst den Einkauf jederzeit fortsetzen.'}</strong><button class="${done===entries.length?'primary':'secondary'}" data-action="finish-shopping">${icon('check')} ${done===entries.length?'Einkauf abschließen':'Rundgang beenden'}</button><p class="tiny muted">Gekaufte Produkte werden aus deiner Liste entfernt. Offene bleiben erhalten.</p></div>`;
  }
  function marketEditorEntries(shop) {
    const session=shoppingSession(),selected=new Map(session?.storeId===shop.id?session.entries.map(e=>[e.itemId,e.product]):[]);
    return model.base.items.filter(i=>!i.deleted).map(i=>({itemId:i.id,product:selected.get(i.id)||i.product,qty:i.qty}));
  }
  function marketPreview(layout,entries) {
    const counts=new Map(Shopping.group(entries,layout).map(g=>[g.area.id,g.entries.length]));
    return `<section class="market-route" aria-label="Vorschau der Produktreihenfolge"><div class="row between"><h2>So führt dich deine Liste</h2><span class="tiny muted">Eingang → Kasse</span></div><p class="small muted">Die Reihenfolge unten sortiert alle Produkte automatisch. Während des Einkaufs brauchst du nur zu scrollen und abzuhaken.</p><div class="market-stops">${layout.areas.map((a,index)=>`<div class="market-stop" style="--area-color:${esc(a.color)}"><span class="stop-number">${index+1}</span><span class="stop-icon" aria-hidden="true">${esc(a.icon)}</span><strong>${esc(a.label)}</strong><small>${counts.get(a.id)||0} Produkte</small></div>`).join('')}</div></section>`;
  }
  function marketProductEditor(layout,entries) {
    return `<section class="settings-card market-settings"><h2>Produkte vorher zuordnen</h2><p class="small muted">Ändere hier bei Bedarf den Bereich. Im Einkauf selbst bleibt eine vollständige Liste ohne Auswahlfelder.</p>${entries.map(e=>`<label class="market-product-assignment"><strong>${esc(e.product.title)}</strong><select class="market-product-area" data-item="${esc(e.itemId)}" aria-label="Bereich für ${esc(e.product.title)}">${layout.areas.map(a=>`<option value="${esc(a.id)}" ${a.id===Shopping.areaFor(e.product,layout,e.itemId).id?'selected':''}>${esc(a.icon)} ${esc(a.label)}</option>`).join('')}</select></label>`).join('')||'<p class="small muted">Füge zuerst Produkte zur Einkaufsliste hinzu.</p>'}</section>`;
  }
  function marketEditor() {
    const shop=store(ui.layoutStore);
    if(!shop)return '<p class="notice">Bitte einen Markt auswählen.</p>';
    const layout=marketLayout(shop),entries=marketEditorEntries(shop),colors=Shopping.colors.map(c=>typeof c==='string'?{value:c,label:c}:c);
    return `<div class="shopping-toolbar"><button class="text-button" data-action="market-editor-done">← Fertig</button>${badge(shop)}</div><div class="page-heading"><div><div class="eyebrow">Dein Markt. Dein Weg.</div><h1>Marktplan für ${esc(shop.name)}</h1><p>Die Bereiche stehen vom Eingang zur Kasse. Verschieben ändert sofort die Reihenfolge deiner Produkte beim Einkauf.</p></div></div>${marketPreview(layout,entries)}<div class="market-editor" aria-label="Bereiche vom Eingang zur Kasse">${layout.areas.map((a,index)=>`<section class="market-editor-row" style="--area-color:${esc(a.color)}"><span class="department-number">${index+1}</span><div class="grow"><label class="form-field">Bereich<input class="market-area-label" data-area="${esc(a.id)}" value="${esc(a.label)}" maxlength="40"></label><div class="area-appearance"><label>Symbol<select class="market-area-icon" data-area="${esc(a.id)}" aria-label="Symbol für ${esc(a.label)}">${Shopping.icons.map(ic=>`<option value="${esc(ic)}" ${ic===a.icon?'selected':''}>${esc(ic)}</option>`).join('')}</select></label><label>Farbe<select class="market-area-color" data-area="${esc(a.id)}" aria-label="Farbe für ${esc(a.label)}">${colors.map((c,i)=>`<option value="${esc(c.value)}" ${c.value===a.color?'selected':''}>${esc(c.label===c.value?['Grün','Blau','Orange','Violett','Rot','Türkis','Rosa','Grau'][i]||'Farbe '+(i+1):c.label)}</option>`).join('')}</select></label></div></div><div class="area-order"><button class="secondary" data-action="move-area" data-area="${esc(a.id)}" data-delta="-1" aria-label="${esc(a.label)} nach vorne" ${index===0?'disabled':''}>↑</button><button class="secondary" data-action="move-area" data-area="${esc(a.id)}" data-delta="1" aria-label="${esc(a.label)} nach hinten" ${index===layout.areas.length-1?'disabled':''}>↓</button>${a.id!=='other'?`<button class="text-button" data-action="delete-area" data-area="${esc(a.id)}" aria-label="${esc(a.label)} entfernen">${icon('trash')}</button>`:''}</div></section>`).join('')}</div><form id="market-add-area" class="market-add-area"><label class="form-field">Neuer Bereich<input id="market-new-label" maxlength="40" required placeholder="z. B. Aktionsregal"></label><button class="secondary" type="submit">${icon('plus')} Bereich hinzufügen</button></form>${marketProductEditor(layout,entries)}<p class="small muted">Änderungen werden für diesen Laden auf deinem Gerät gespeichert, auch bei einem App-Update. Produkte aus entfernten Bereichen findest du unter „Sonstiges“. Die Produktzuordnung oben bestimmt, in welchem Bereich ein Artikel steht.</p><div class="shopping-finish"><button class="primary" data-action="market-editor-done">${icon('check')} Fertig – Reihenfolge übernehmen</button><p class="tiny muted">Schon während der Bearbeitung automatisch gespeichert.</p></div>`;
  }
  function marketSettings() {
    const shops=C.stores.filter(s=>model.base.settings.enabledStores.includes(s.id));
    return `<section class="settings-card market-settings"><h2>Deine Marktpläne</h2><p class="small muted">Lege die Reihenfolge der Bereiche je Laden fest. Beim Einkauf werden deine Produkte entsprechend sortiert.</p>${shops.map(s=>`<button class="secondary wide" data-action="edit-market" data-store="${esc(s.id)}">${badge(s)} Marktplan für ${esc(s.name)} anpassen</button>`).join('')||'<p class="small">Wähle zuerst deine Läden.</p>'}</section>`;
  }
  function settingsPage() {
    const s=state().settings;
    return `<div class="page-heading"><div><div class="eyebrow">Deine Sparnah-App</div><h1>Einfach. Kostenlos. Lokal.</h1><p>Deine Liste auf diesem Gerät · Angebotsdaten privat freigegeben.</p></div></div><div class="settings-grid"><div class="stack"><section class="settings-card"><h2>Einkaufsplanung</h2>${destinationSelector(s)}<span class="field-label">Höchstens so viele Geschäfte</span>${maxStoreSelector()}<div class="settings-row"><div><h3>Mehrere Einkaufstage</h3><p>Erlaubt verschiedene Angebotstage bei höchstens einem Besuch je Laden.</p></div><label class="switch"><input id="split-days" type="checkbox" ${s.allowSplitDays ? 'checked' : ''}><span></span></label></div><div class="settings-row"><div><h3>Kundenkarten und App-Rabatte</h3><p>Immer ausgeschlossen. Kein Bonus-Abzug.</p></div>${icon('shield')}</div></section><section class="settings-card"><h2>Privater Zugriff</h2><p class="small muted">Die Freigabe bleibt auf diesem Gerät. Mit der Zugriffsdatei kannst du auch dein Handy freigeben. Sie gehört nicht in öffentliche Nachrichten oder ins Repository.</p><div class="stack"><button class="secondary wide" data-action="export-access">${icon('download')} Zugriffsdatei für ein anderes Gerät</button><button class="secondary wide" data-action="lock-access">${icon('shield')} Auf diesem Gerät sperren</button></div><p class="small muted">Deine Einkaufsliste und Marktauswahl bleiben beim Sperren erhalten. Zum Öffnen brauchst du erneut die Zugriffsdatei.</p></section><section class="settings-card"><h2>Auf deinem Android-Handy</h2><button class="secondary wide" data-action="install">${icon('download')} Als App installieren</button><div class="settings-row"><div><h3>Externe Produktbilder</h3><p>Bei vorhandener Quelle, sonst Symbolbilder.</p></div><label class="switch"><input type="checkbox" id="photos" ${model.photos!==false?'checked':''}><span></span></label></div></section></div><div class="stack"><section class="settings-card"><h2>Deine Marktauswahl</h2><button class="text-button" data-action="tab" data-tab="stores">${icon('pin')} Alle Läden und Datenabdeckung ansehen</button><p class="small muted">Angebote und geprüfte Normalpreise fließen in die Summe ein. Bei einem Laden bleibt die ganze Einkaufsliste zusammen; fehlende Preise bleiben offen. Jeder Händler erscheint einmal.</p>${C.stores.map(st=>`<div class="store-setting"><input type="checkbox" aria-label="${esc(st.name)} einplanen" class="store-toggle" data-store="${st.id}" ${s.enabledStores.includes(st.id)?'checked':''}>${badge(st)}<span class="grow"><strong>${esc(st.name)}</strong><small>${offers().filter(o=>o.storeId===st.id&&E.overlapsWeek(o,weekStart())).length} erfasste Preise ${weekName().toLowerCase()}</small></span></div>`).join('')}</section><section class="settings-card"><h2>Liste und Angebotsdaten</h2><div class="stack"><button class="secondary wide" data-action="refresh-offers">${icon('refresh')} Online-Daten neu laden</button><button class="secondary wide" data-action="sources">${icon('info')} Datenstand und Quellen</button><button class="secondary wide" data-action="backup">${icon('download')} Liste sichern</button><button class="secondary wide" data-action="import-backup">${icon('upload')} Sicherung einlesen</button><button class="secondary wide" data-action="add-offer">${icon('plus')} Ein Angebot ergänzen</button></div><div class="notice">Angebote und Prospekte werden zweimal täglich zur Prüfung abgerufen. Beim Start, Wiederöffnen und nach Wiederherstellung der Verbindung lädt Sparnah den neuesten veröffentlichten Stand. Anzeige, Sparplan und Fehlermeldungen berücksichtigen deine ausgewählten Läden. Die Auswahl bleibt auf deinem Gerät. Deine Einkaufsliste bleibt ausschließlich im Speicher dieses Handys; sichere sie gelegentlich.</div></section></div></div><div class="settings-footer">Sparnah · kostenlose GitHub-Pages-Ausgabe · Kein Abo, keine eingebettete Werbung.<br><button data-action="privacy">Datenschutz und Datenstand</button></div>`;
  }
  function render() {
    const focused = document.activeElement?.id;
    const pos = ['search','brand-search','store-search'].includes(focused) ? $(focused)?.selectionStart : null;
    renderHeader();
    $('main').innerHTML = (['list','plan','offers','brands','leaflets'].includes(ui.tab)?marketSelectionPrompt():'') + (privateDataWarning ? `<div class="offline-banner" role="status">${esc(privateDataWarning)}</div>` : '') + (!storageAvailable ? '<div class="offline-banner">Speicherung im Browser eingeschränkt. Bitte deine Liste regelmäßig exportieren.</div>' : '') + (['list','plan'].includes(ui.tab)?resumeShopping():'') + (ui.tab === 'shopping' ? shoppingPage() : ui.tab === 'market-layout' ? marketEditor() : ui.tab === 'list' ? listPage() : ui.tab === 'offers' ? offersPage() : ui.tab === 'brands' ? brandsPage() : ui.tab === 'leaflets' ? leafletsPage() : ui.tab === 'plan' ? planPage() : ui.tab === 'stores' ? storesPage() : settingsPage()+marketSettings()+estimateGuide());
    if(ui.tab==='brands'){renderBrandSuggestions();if(focused==='brand-search'){$('brand-search').focus({preventScroll:true});if(pos!==null)try{$('brand-search').setSelectionRange(pos,pos);}catch{}}}
    if (ui.tab === 'list') { renderSuggestions(); if (focused === 'search') { $('search').focus({preventScroll:true}); if (pos !== null) try { $('search').setSelectionRange(pos,pos); } catch {} } }
  }
  function searchResult(){
    const key=JSON.stringify([ui.query,ui.searchStore,ui.searchCategory,ui.searchLimit]);
    if(searchMemo?.key!==key)searchMemo={key,result:S.search(searchIndex,ui.query,{store:ui.searchStore,category:ui.searchCategory,limit:ui.searchLimit})};
    return searchMemo.result;
  }
  function findProducts() {
    if(!ui.query.trim()&&ui.searchStore==='all'&&ui.searchCategory==='all')return ['butter','milch','nudeln','eier','reis','aepfel','joghurt'].map(product).filter(Boolean);
    return searchResult().items;
  }
  function renderSuggestions() {
    if (!$('suggestions')) return;
    const results = findProducts();
    $('search').setAttribute('aria-expanded', String(ui.searchOpen));
    $('suggestions').hidden = !ui.searchOpen;
    if (!ui.searchOpen) return;
    $('suggestions').innerHTML = `<div class="suggestions-label">${ui.query.trim() ? 'Passende Produkte' : 'Produktvorschläge'}</div>` + results.map((p,i) => {const best=matching(p).find(o=>o.match.status!=='uncertain'); return `<button class="suggestion" role="option" id="suggestion-${i}" aria-selected="${ui.selected === i}" data-action="add-product" data-id="${esc(p.id)}">${thumb(p)}<span class="grow"><span class="name">${esc(p.title)}</span><span class="product-sub" style="display:block">${esc(productSubtitle(p))}</span></span>${best ? `<span class="price">${E.money(best.offer.priceCents)}</span>` : ''}<span class="suggestion-add">${icon('plus')}</span></button>`;}).join('') + (ui.query.trim() ? `<button class="suggestion" role="option" id="suggestion-${results.length}" aria-selected="${ui.selected === results.length}" data-action="custom-product"><span class="planner-icon">${icon('plus')}</span><span class="grow"><span class="name">„${esc(ui.query.trim())}“ selbst hinzufügen</span><span class="product-sub" style="display:block">Ohne automatische Angebotszuordnung</span></span></button>` : '') + (searchResult().total>ui.searchLimit&&(ui.query.trim()||ui.searchStore!=='all'||ui.searchCategory!=='all')?`<button class="secondary wide" data-action="more-products">Mehr anzeigen (${Math.min(ui.searchLimit,searchResult().total)} von ${searchResult().total})</button>`:'') + `<div class="suggestions-label" style="text-transform:none;letter-spacing:0">Die Quelle ist keine Ladenbindung. Andere Händler können dieses Produkt ebenfalls führen; Bestand und Preise sind nicht vollständig erfasst.</div>`;
    if (ui.selected >= 0) $('search').setAttribute('aria-activedescendant',`suggestion-${ui.selected}`); else $('search').removeAttribute('aria-activedescendant');
  }
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('show'); toastTimer = setTimeout(()=>$('toast').classList.remove('show'),4000); }
  function openDialog(title, body) { $('dialog-content').innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button class="close-button" data-action="close-dialog" aria-label="Dialog schließen">${icon('close')}</button></div><div class="dialog-body">${body}</div>`; if (!$('dialog').open) $('dialog').showModal(); }
  function closeDialog() { $('dialog').close(); }
  function addProduct(p, qty=1) {
    if (!p) return toast('Produkt nicht mehr im Katalog. Bitte erneut suchen.');
    ui.query='';ui.searchOpen=false;ui.selected=-1;
    perform({type:'item.add',itemId:p.id,product:p,qty});toast(`${p.title} hinzugefügt`);
  }
  function showProduct(id) {
    const item=model.base.items.find(i=>i.id===id&&!i.deleted);
    const p = item?.product || product(id); if (!p) return;
    const entries = matching(item?effectiveProduct(item):p, item?.qty || 1);
    openDialog(p.title, `<div class="row" style="margin-bottom:17px">${thumb(p)}<div><strong>${esc(productSubtitle(p))}</strong><p class="muted tiny">${item?.choiceMode==='cheapest'?esc(resolveChoice(p).description):p.variantId?'Eine konkrete Sorte – deine Auswahl bleibt erhalten.':'Allgemeiner Wunsch – die Sorte darf variieren.'}</p></div></div>${safeUrl(p.manufacturerSourceUrl) ? `<p class="small muted">Herstellerreferenz vom ${esc(p.manufacturerCheckedAt)} · <a href="${esc(safeUrl(p.manufacturerSourceUrl))}" target="_blank" rel="noopener noreferrer">Herstellerquelle ↗</a>. Preise und Verfügbarkeit brauchen einen separaten Händlernachweis.${p.manufacturerFreshFetchStatus?' '+esc(p.manufacturerFreshFetchStatus):''}</p>` : ''}${safeUrl(p.assortmentSourceUrl)?`<p class="small muted">${esc(store(p.assortmentStoreId)?.name)} · Produktangaben vom ${esc(p.assortmentCheckedAt)} · <a href="${esc(safeUrl(p.assortmentSourceUrl))}" target="_blank" rel="noopener noreferrer">Sortimentsquelle ↗</a>. ${esc(p.packNote||'Kein Nachweis für Filialbestand oder Angebotspreis.')}</p>`:''}${p.selectionHint?`<p class="notice">${esc(p.selectionHint)}</p>`:''}${!entries.some(x=>x.match.status!=='uncertain')?estimateMarkup(item||{product:p,qty:1}):''}<h3>Erfasste Preise · ${weekText()}</h3>${entries.length ? entries.map(x=>`<div class="detail-offer"><div class="row">${badge(store(x.offer.storeId))}<div class="grow"><strong>${esc(store(x.offer.storeId)?.name)}</strong><p class="tiny muted">${esc(x.offer.title)} · ${priceKind(x.offer)}</p></div><span class="price">${E.money(x.offer.priceCents)}</span></div><p class="tiny muted" style="margin-top:7px">${E.packLabel(x.offer.pack)} · ${E.shortDate(x.offer.start)}${x.offer.end ? '–'+E.shortDate(x.offer.end) : ' · Ende offen'}${x.offer.depositCents ? ` · + ${E.money(x.offer.depositCents)} Pfand` : ''}</p>${x.match.status==='uncertain' ? `<div class="notice">${esc(x.match.reasons.join('. '))}. Wird nicht in den verlässlichen Plan eingerechnet.</div>` : `<p class="tiny" style="margin-top:7px;color:var(--green)">${x.match.status==='group'?'Passt zur allgemeinen Auswahl.':'Sorte und Packung stimmen überein.'}</p>`}<a class="text-button" href="${esc(safeUrl(x.offer.sourceUrl))}" target="_blank" rel="noopener noreferrer">Quelle prüfen ↗</a></div>`).join('') : '<div class="notice">Noch kein bestätigtes Angebot erfasst. Das bedeutet nicht, dass dieses Produkt nirgends reduziert ist.</div>'}<p class="small muted" style="margin-top:14px">Einzelpreise gelten je Packung. Die Begrenzung der Geschäfte wird erst im Sparplan berücksichtigt. Verfügbarkeit vor Ort nicht bestätigt.</p><div class="dialog-actions"><button class="primary" data-action="add-product-close" data-id="${esc(id)}">${icon('plus')} Zur Liste</button><button class="secondary" data-action="add-offer" data-id="${esc(id)}">Preis ergänzen</button></div>`);
  }
  function importLabel(){
    if(IS_FILE) return 'Nur lokale Vorschau – keine neuen Angebote über Dateizugriff';
    if(!importStatus?.lastAttemptAt) return 'GitHub-Angebotsabruf wurde noch nicht ausgeführt';
    if(!selectedData().stores.length)return 'Keine Läden ausgewählt';
    const failed=selectedData().failures;
    if(failed) return `${failed} Händlerprüfung(en) fehlgeschlagen; angezeigte Daten können unvollständig sein`;
    if(!importStatus.lastSuccessAt) return 'Noch keine erfolgreich übernommenen Angebote';
    return 'Automatische Prüfung über GitHub Actions · Abdeckung unvollständig';
  }
  function showSources(){
    const stamp=t=>{try{return t?new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(t)):'Noch nicht';}catch{return 'Nicht bekannt';}};
    openDialog('Onlineangebote und Datenstand',`<div class="notice"><strong>${esc(importLabel())}</strong><p style="margin-top:8px">${selectedData().prices.length} erfasste Preise für deine ausgewählten Läden · ${allProducts().length.toLocaleString('de-DE')} bekannte Produkte. Nur geprüfte öffentliche Angebotsbedingungen ohne Karte oder App. Kein vollständiger Marktvergleich.</p></div><h3 style="margin-top:16px">Normalpreise im Sparplan</h3><p>Geprüfte Normalpreise werden zusammen mit Angeboten verglichen. Ein Preis ohne bestätigten Zeitraum zählt nur am Prüftag. UVP und durchgestrichene Vergleichspreise werden nicht als aktueller Normalpreis übernommen.</p>${selectedData().hasNormalPrices&&importStatus?.normalPrices?`<p><strong>ALDI-SÜD-Preisprüfung: ${importStatus.normalPrices.state==='ok'?'erfolgreich':'fehlgeschlagen'}</strong> · ${esc(stamp(importStatus.normalPrices.checkedAt||importStatus.normalPrices.lastAttemptAt))}<br>${esc(importStatus.normalPrices.message)} <a href="${esc(safeUrl(importStatus.normalPrices.sourceUrl))}" target="_blank" rel="noopener noreferrer">Preisquelle ↗</a></p>`:''}<h3 style="margin-top:16px">Lebensmittel- und Getränkesortimente</h3><p>ALDI-Katalog täglich, weitere Sortimente wöchentlich zur Prüfung vorgesehen. Maßgeblich ist das Prüfdatum je Quelle. Öffentliche Auswahl, kein vollständiges Filialsortiment und kein Preisnachweis.</p>${assortmentError?`<p>${esc(assortmentError)}</p>`:''}${Object.entries(assortment.sources).map(([id,src])=>`<p><strong>${esc(store(id)?.name||id)}: ${Number(src.count).toLocaleString('de-DE')} Produkte</strong> · geprüft ${esc(src.checkedAt||'noch nicht')}<br>${esc(src.message)} ${src.state==='error'?'Abruf fehlgeschlagen; letzter Stand bleibt sichtbar.':''}<br><a href="${esc(safeUrl(src.sourceUrl))}" target="_blank" rel="noopener noreferrer">Sortimentsübersicht ↗</a></p>`).join('')}<div class="import-status"><div><span>Letzter Versuch</span><strong>${esc(stamp(importStatus?.lastAttemptAt))}</strong></div><div><span>Letzter Erfolg</span><strong>${esc(stamp(importStatus?.lastSuccessAt))}</strong></div><div><span>Geplant</span><strong>2 × täglich über GitHub</strong></div></div><p>Beim Start und Wiederöffnen wird der veröffentlichte Stand automatisch abgeglichen. Hier siehst du die Quellen deiner ausgewählten Läden. Der Button lädt denselben Stand erneut; die Händlerabfrage läuft zweimal täglich. Ohne öffentlich zugängliche Händlerdaten kann eine Quelle leer bleiben. Kein Treffer bedeutet nicht „nirgends im Angebot“.</p><div>${selectedData().stores.map(s=>{const st=sourceStatusFor(s);return `<div class="source-row">${badge(s)}<div class="grow"><strong>${esc(s.name)}</strong><p>${offers().filter(o=>o.storeId===s.id&&E.overlapsWeek(o,weekStart())).length} erfasste Preise im gewählten Wochenzeitraum (Angebote und Normalpreise)<br>${esc(st?.message || 'Für diesen Laden gibt es noch keinen automatischen Angebotsleser.')}</p>${st?.reviewedDetails?`<p>${Number(st.reviewedDetails.offers)} zusätzlich an der Originalquelle geprüfte Angebote. ${esc(st.reviewedDetails.message)} Prüfung: ${esc(stamp(st.reviewedDetails.checkedAt))}</p>`:''}${st?.lastSuccessAt?`<p>Letzter erfolgreicher Abruf: ${esc(stamp(st.lastSuccessAt))}</p>`:''}${st?.rejected?`<p>${Number(st.rejected)} unklare Einträge ausgeschlossen.</p>`:''}<a href="${esc(safeUrl(st?.sourceUrl||s.url))}" target="_blank" rel="noopener noreferrer">Offizielle Händlerseite ↗</a></div></div>`;}).join('')}</div><p>Eine konkrete FRoSTA-Sorte ist nur dann ein sicherer Treffer, wenn sie belegt im Gruppenangebot enthalten ist. Bilder allein genügen nicht.</p><div class="dialog-actions"><button class="primary" data-action="refresh-offers" ${IS_FILE?'disabled':''}>${icon('refresh')} Daten neu laden</button><button class="secondary" data-action="close-dialog">Schließen</button></div>`);
  }
  function applyPrivateData(data, status = Vault.getStatus()) {
    if (!data) return;
    const view=window.SparnahStores.project(data.catalog,model.base.settings,E);
    C=view.catalog;storeAliases=view.aliases;model.base.settings=view.settings;persist(); assortment=data.assortment; importStatus=data.status; leafletData=data.leaflets;
    assortmentError=''; leafletError=''; leafletLoaded=true;
    privateDataWarning=status.error || (status.checking?'Gespeicherter Stand geladen. Aktuelle Daten werden im Hintergrund geprüft.':status.offline?'Offline: Zuletzt sicher gespeicherte Daten. Preise und Prospekte werden weiterhin nach ihrem Gültigkeitsdatum gefiltert.':status.cacheAvailable===false?'Offline-Speicherung ist in diesem Browser derzeit nicht möglich.':'' );
    memoKey=''; reindex(); render();
  }
  async function refreshPrivateData(force=false) {
    try {
      const result=await Vault.refresh(force);
      if(force && result.offline)toast('Offline – der letzte sicher gespeicherte Stand bleibt sichtbar.');
      return result.ok && !result.offline;
    } catch { if(force)toast('Daten derzeit nicht erreichbar. Der letzte sicher geladene Stand bleibt sichtbar.'); return false; }
  }
  async function refreshCatalog(force=false){return refreshPrivateData(force);}
  async function refreshOffers(){
    const success=await refreshPrivateData(true);
    if(success)toast('Private Daten sicher geladen. Der Händlerabruf läuft automatisch nach Zeitplan.');
    showSources();
  }
  function offerForm(productId) {
    const choices=allProducts(), p=product(productId)||choices[0];
    if(!p || !C.stores.length)return toast('Für einen eigenen Preis werden ein Produkt und ein Markt benötigt.');
    openDialog('Preis ergänzen', `<p>Hier kannst du freiwillig einen belegten Normalpreis oder Angebotspreis ergänzen. Ohne Enddatum zählt er nur am angegebenen Tag.</p><form id="offer-form"><div class="form-grid"><label class="form-field full">Produkt oder Produktgruppe<select id="offer-product">${choices.map(x=>`<option value="${esc(x.id)}" ${x.id===p.id?'selected':''}>${esc(x.title)} · ${esc(productSubtitle(x))}</option>`).join('')}</select></label><label class="form-field full">Bezeichnung beim Händler<input id="offer-title" required maxlength="180" value="${esc(p.title)}"></label><div class="form-field">Geschäft${storePicker('offer-shop',C.stores,C.stores[0]?.id,null)}</div><label class="form-field">Preisart<select id="offer-kind"><option value="promotion">Angebot</option><option value="regular">Normalpreis</option></select></label><label class="form-field">Preis je Packung (€)<input id="offer-price" inputmode="decimal" placeholder="z. B. 2,49" required pattern="[0-9]+([.,][0-9]{1,2})?"></label><label class="form-field">Gültig ab<input id="offer-start" type="date" value="${weekStart()}" required></label><label class="form-field">Gültig bis (optional)<input id="offer-end" type="date"><small>Leer: Im Plan zählt nur der Starttag.</small></label><label class="form-field">Packungsinhalt<input id="offer-pack" value="${p.pack?`${p.pack.min}${p.pack.min===p.pack.max?'':'–'+p.pack.max}`:''}" placeholder="z. B. 450–500"><small>Gramm / Milliliter verwenden, nicht kg / l.</small></label><label class="form-field">Einheit<select id="offer-unit">${['g','ml','St.','Blatt'].map(u=>`<option ${p.pack?.unit===u?'selected':''}>${u}</option>`).join('')}</select></label><label class="form-field">Belegter Vergleichspreis (€)<input id="offer-reference" inputmode="decimal" placeholder="Nur falls belegt"><small>Keinen geschätzten Normalpreis eintragen.</small></label><label class="form-field">Pfand je Packung (€)<input id="offer-deposit" inputmode="decimal" placeholder="0,00"></label><label class="form-field">Mindestmenge (Packungen)<input id="offer-min" type="number" value="1" min="1" max="99" required></label><label class="form-field">Höchstmenge (optional)<input id="offer-max" type="number" min="1" max="99" placeholder="Keine bekannte Grenze"></label><label class="form-field full">Link zur Angebotsquelle (https)<input id="offer-source" type="url" required value="${esc(C.stores[0].url)}"><small>Der Link wird gespeichert, nicht automatisch ausgewertet.</small></label></div><label class="form-checkbox"><input id="offer-various" type="checkbox" ${!p.variantId?'checked':''}><span>„Verschiedene Sorten“ – konkrete Sorten sind nicht einzeln bestätigt.</span></label><label class="form-checkbox"><input id="offer-confirm" type="checkbox" required><span>Preis, Packung und Zeitraum sind geprüft. Das Angebot gilt <strong>ohne Kundenkarte, App-Coupon oder Bonus-Abzug.</strong></span></label><p class="form-error" id="offer-error" role="alert"></p><div class="dialog-actions"><button class="primary" type="submit">${icon('check')} Preis speichern</button><button class="secondary" type="button" data-action="close-dialog">Abbrechen</button></div></form>`);
  }
  function parseMoney(text, optional=false) {
    const t=String(text||'').trim(); if(!t && optional)return null;
    if(!/^\d+([.,]\d{1,2})?$/.test(t))throw new Error('Bitte einen gültigen Preis mit höchstens zwei Nachkommastellen eingeben.');
    const cents=Math.round(Number(t.replace(',','.'))*100); if(cents<0||cents>1000000)throw new Error('Preis außerhalb des zulässigen Bereichs.');return cents;
  }
  function saveOffer(event) {
    event.preventDefault();
    try {
      const p=product($('offer-product').value), start=$('offer-start').value, end=$('offer-end').value||null;
      const price=parseMoney($('offer-price').value);if(price<=0)throw new Error('Der Packungspreis muss größer als 0 sein.');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(new Date(start).getTime()))throw new Error('Bitte ein gültiges Startdatum eingeben.');
      if(end&&(end<start||new Date(end)-new Date(start)>366*86400000))throw new Error('Bitte einen gültigen Angebotszeitraum bis maximal ein Jahr wählen.');
      const raw=$('offer-pack').value.trim();let pack=null;
      if(raw){const m=raw.match(/^(\d+)\s*(?:[–-]\s*(\d+))?$/);if(!m)throw new Error('Packungsinhalt bitte z. B. als 500 oder 450–500 eingeben.');pack={min:Number(m[1]),max:Number(m[2]||m[1]),unit:$('offer-unit').value};if(pack.min<1||pack.max<pack.min||pack.max>100000)throw new Error('Ungültige Packungsgröße.');}
      const minQty=Number($('offer-min').value), maxQty=$('offer-max').value?Number($('offer-max').value):null;
      if(!Number.isInteger(minQty)||minQty<1||minQty>99||(maxQty!==null&&(!Number.isInteger(maxQty)||maxQty<minQty||maxQty>99)))throw new Error('Bitte gültige Mindest- und Höchstmengen eingeben.');
      const source=safeUrl($('offer-source').value);if(!source)throw new Error('Eine gültige HTTPS-Quellenadresse ist erforderlich.');
      if(!$('offer-confirm').checked)throw new Error('Bitte die Angebotsbedingungen bestätigen.');
      const reference=parseMoney($('offer-reference').value,true);if(reference!==null && reference<price)throw new Error('Ein Rabatt-Vergleichspreis darf nicht kleiner als der Angebotspreis sein.');
      const o={id:'own:'+uid(),productId:p.id,storeId:$('offer-shop').value,title:$('offer-title').value.trim(),groupIds:[p.groupId],variantIds:p.variantId&&!$('offer-various').checked?[p.variantId]:null,pack,priceCents:price,referencePriceCents:reference,depositCents:parseMoney($('offer-deposit').value,true)||0,start,end,requiresCard:false,requiresApp:false,sourceUrl:source,observedAt:E.berlinToday(),verification:'household',priceKind:$('offer-kind').value==='regular'?'regular':'promotion',minQty,maxQty,note:'Von eurem Haushalt erfasst; nicht automatisch gegen die Quelle geprüft.'};
      if(!o.title)throw new Error('Bitte die Angebotsbezeichnung eingeben.');
      closeDialog();perform({type:'offer.add',offer:o});toast('Preis auf deinem Gerät gespeichert.');
    }catch(e){$('offer-error').textContent=e.message;}
  }
  async function copyText(value, label='Kopiert') {
    try{await navigator.clipboard.writeText(value);toast(label);}
    catch{const textarea=document.createElement('textarea');textarea.value=value;textarea.style.position='fixed';textarea.style.opacity='0';document.body.append(textarea);textarea.select();let ok=false;try{ok=document.execCommand('copy');}catch{}textarea.remove();if(ok)toast(label);else openDialog('Text zum Kopieren',`<label class="form-field">Text markieren und kopieren<textarea rows="8" readonly>${esc(value)}</textarea></label>`);}
  }
  async function shareText(text,title='Sparnah') {if(navigator.share){try{await navigator.share({title,text});return;}catch(e){if(e.name==='AbortError')return;}}await copyText(text,'Zum Teilen kopiert');}
  function listText(){const items=state().items.filter(i=>!i.deleted);return `Meine Einkaufsliste · Sparnah\n\n${items.map(i=>`${i.checked?'✓':'☐'} ${i.qty} × ${i.product.title} (${productSubtitle(i.product)})`).join('\n')}\n\nDie aktuelle Liste bleibt ausschließlich auf diesem Gerät.`;}
  function planText(){
    const p=getPlan();if(p.empty)return 'Deine Einkaufsliste ist noch leer.';
    const pending=p.unknown.filter(u=>!u.assignedStoreId);
    return `Sparnah · ${weekText()}\n${p.complete?'Gesamtpreis':'Bekannte Zwischensumme'}: ${p.coverage?E.money(p.total):'Preise noch offen'}\n${p.coverage} von ${p.count} Preisen bekannt.${p.deposit?'\nPfand zusätzlich: '+E.money(p.deposit):''}\n\n${p.visits.map(v=>`${E.shortDate(v.day,true)}: ${v.store.name}\n${v.lines.map(l=>`• ${l.item.qty} × ${selectedProduct(l).title}: ${E.money(l.cost)} (${priceKind(l.offer)}, ${E.packLabel(l.offer.pack)}${packChange(l)?'; '+packChange(l):''})`).join('\n')}${(v.unpriced||[]).map(u=>`\n• ${u.item.qty} × ${(u.item.requestedProduct||u.item.product).title}: hier mitkaufen, ${estimateText(u.item)}, Verfügbarkeit nicht bestätigt`).join('')}`).join('\n\n')}${pending.length?'\n\nNoch keinem Laden zugeordnet:\n'+pending.map(u=>`• ${u.item.qty} × ${(u.item.requestedProduct||u.item.product).title}: ${u.reason}; ${estimateText(u.item)}`).join('\n'):''}${priceGuide?.summarize(p.unknown,E.berlinToday()).count?'\n\nGeschätzte '+(priceGuide.summarize(p.unknown,E.berlinToday()).remaining?'Teilsumme':'Budgetsumme')+': ca. '+E.money(p.total+priceGuide.summarize(p.unknown,E.berlinToday()).total)+' (belegte Preise plus Richtwerte, ohne Pfand).':''}\n\nBelegte Zwischensumme nur aus erfassten Preisen, ohne Fahrtkosten. ${p.complete?'':'Offene Preise fehlen in der Summe. '}Bestand vor Ort nicht bestätigt.`;
  }
  function downloadJson(name,data){const json=JSON.stringify(data,null,2);if(/SparnahAndroid\//.test(navigator.userAgent||'')){window.prompt('sparnah-save:'+name,json);return;}const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function backup(){downloadJson('sparnah-sicherung-'+E.berlinToday()+'.json',{schemaVersion:1,exportedAt:new Date().toISOString(),state:state()});toast('Sicherung erstellt – ohne privaten Verbindungscode.');}
  async function importBackup(file){
    try{
      if(!file||file.size>2000000)throw new Error('Bitte eine Sicherungsdatei unter 2 MB auswählen.');
      const b=JSON.parse(await file.text());if(b.schemaVersion!==1||!Array.isArray(b.state?.items)||!Array.isArray(b.state?.offers)||b.state.items.length>500)throw new Error('Keine gültige Sparnah-Sicherung.');
      const ops=[];
      for(const item of b.state.items.filter(i=>!i.deleted)){
        const p=S.restoreProduct(item,searchIndex);
        if(!p||typeof p.title!=='string'||p.title.length>180||!/^([A-Za-z0-9_:.-]){1,120}$/.test(item.id)||p.id!==item.id||!Number.isInteger(item.qty)||item.qty<1||item.qty>99)throw new Error('Die Sicherung enthält ungültige Produkte.');

        ops.push({type:'item.add',itemId:p.id,product:p,qty:item.qty});if(['exact','cheapest'].includes(item.choiceMode))ops.push({type:'item.choice',itemId:p.id,mode:item.choiceMode});if(item.checked)ops.push({type:'item.check',itemId:p.id,checked:true});
      }
      for(const o of b.state.offers){
        if(!o.id?.startsWith('own:')||!C.stores.some(s=>s.id===o.storeId)||!Number.isInteger(o.priceCents)||o.priceCents<=0||!safeUrl(o.sourceUrl)||o.requiresCard!==false||o.requiresApp!==false||typeof o.title!=='string'||o.title.length>180||!/^\d{4}-\d{2}-\d{2}$/.test(o.start))throw new Error('Die Sicherung enthält ein ungültiges eigenes Angebot.');
        ops.push({type:'offer.add',offer:{...o,verification:'household'}});
      }
      openDialog('Sicherung zur Liste hinzufügen?',`<p>${ops.filter(o=>o.type==='item.add').length} Produkte und ${b.state.offers.length} eigene Angebote werden ergänzt. Bereits vorhandene Produktmengen werden addiert. Andere Einträge bleiben erhalten.</p><div class="dialog-actions"><button class="primary" id="confirm-import">Jetzt ergänzen</button><button class="secondary" data-action="close-dialog">Abbrechen</button></div>`);
      $('confirm-import').onclick=()=>{for(const op of ops)perform(op,false);closeDialog();render();toast('Sicherung ergänzt.');};
    }catch(e){toast(e.message);}
    $('backup-file').value='';
  }
  function showPrivacy(){openDialog('Datenschutz und Quellen',`<p><strong>Deine Liste:</strong> Sie wird nur im Browserspeicher dieses Handys gespeichert. Keine Anmeldung, kein Nutzerkonto, keine Cloud-Synchronisation. Website-Daten löschen kann deine Liste löschen. Du kannst sie als JSON exportieren.</p><p><strong>Angebote:</strong> GitHub Actions versucht öffentlich zugängliche Händlerseiten in festen Abständen auszulesen. Der Datenbestand mit Filialen, Angeboten und Abrufstatus wird ausschließlich verschlüsselt veröffentlicht und erst auf deinem Gerät geöffnet. Die Zugriffsdatei wird nicht an den Server gesendet. Deine Einkaufsliste wird nicht übertragen.</p><p><strong>Bilder:</strong> Externe Bildserver können technische Verbindungsdaten empfangen. Fehlende Bilder werden durch Symbole ersetzt. Gruppenbilder sagen nichts darüber aus, welche Sorte angeboten wird.</p><p><strong>Karten:</strong> Google Maps und Händlerseiten werden erst nach deinem Klick geöffnet.</p><p><strong>Wichtig:</strong> Die App ist nicht von den Händlern betrieben. Gültigkeit, Sortiment und Öffnungszeiten am Markt bitte selbst prüfen.</p><button class="secondary" data-action="close-dialog">Schließen</button>`);}
  function confirmAction(title,body,action){openDialog(title,`<p>${body}</p><div class="dialog-actions"><button class="danger-button" data-action="${action}">Bestätigen</button><button class="secondary" data-action="close-dialog">Abbrechen</button></div>`);}
  function navigate(tab){ui.tab=tab;ui.searchOpen=false;ui.brandOpen=false;render();window.scrollTo({top:0,behavior:'instant'});}

  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-action]');
    if(!b){for(const picker of document.querySelectorAll?.('.store-picker[open]')||[])if(!picker.contains(event.target))picker.open=false;if(ui.brandOpen&&!event.target.closest('.brand-input-wrap')){ui.brandOpen=false;renderBrandSuggestions();}if(ui.searchOpen&&!event.target.closest('.search-wrap')){ui.searchOpen=false;renderSuggestions();}return;}
    event.preventDefault();const action=b.dataset.action,id=b.dataset.id;
    try{
      if(action==='pick-store')chooseStore(b.dataset.control,b.dataset.value);
      else if(action==='tab')navigate(b.dataset.tab);
      else if(action==='start-shopping')startShopping(b.dataset.store,b.dataset.day);
      else if(action==='finish-shopping'){
        const session=shoppingSession(),purchased=session?shoppingEntries(session).filter(entry=>entry.checked):[];
        for(const itemId of new Set(purchased.map(entry=>entry.itemId)))apply(model.base,{type:'item.remove',itemId});
        delete model.shoppingSession;persist();reindex();navigate('list');
        toast(purchased.length?'Einkauf beendet. Gekaufte Produkte wurden aus deiner Liste entfernt. Offene bleiben erhalten.':'Rundgang beendet. Deine offenen Produkte bleiben auf der Liste.');
      }
      else if(action==='edit-market'){ui.layoutStore=b.dataset.store;ui.layoutReturn=ui.tab; navigate('market-layout');}
      else if(action==='market-editor-done')navigate(['shopping','plan'].includes(ui.layoutReturn)?ui.layoutReturn:'settings');
            else if(action==='move-area'){const shop=store(ui.layoutStore);if(shop)saveMarketLayout(shop,Shopping.moveArea(marketLayout(shop),b.dataset.area,Number(b.dataset.delta)));}
      else if(action==='delete-area'){const shop=store(ui.layoutStore);if(shop){saveMarketLayout(shop,Shopping.removeArea(marketLayout(shop),b.dataset.area));toast('Bereich entfernt. Seine Produkte stehen jetzt unter Sonstiges.');}}
      else if(action==='brand-query')selectBrand(b.dataset.brand);
      else if(action==='close-dialog')closeDialog();
      else if(action==='add-product')addProduct(product(id));
      else if(action==='add-product-close'){closeDialog();addProduct(product(id));}
      else if(action==='more-products'){ui.searchLimit+=24;renderSuggestions();}
      else if(action==='custom-product'){const title=ui.query.trim().slice(0,120);if(title){const id='custom:'+uid();addProduct({id,title,subtitle:'Eigenes Produkt · Preis noch offen',groupId:id,variantId:null,brand:'',category:'Eigene Produkte',emoji:'🛒',pack:null,image:null,keywords:''});}}
      else if(action==='sample'){
        if(!hasSelectedStores()){navigate('stores');toast('Wähle zuerst deine Märkte. Danach kannst du mit echten Preisen starten.');return;}
        const candidates=['butter','milch','nudeln','eier','aepfel'].map(product).filter(Boolean).map(p=>({id:p.id,product:p,qty:1}));
        const plan=E.optimize(candidates,offers(),C.stores,{...state().settings,weekStart:weekStart(),notBefore:E.berlinToday()});
        const covered=(plan.lines||[]).filter(Boolean).slice(0,3);
        if(!covered.length){toast('Für diese Auswahl fehlen passende Beispielpreise. Du kannst eigene Produkte aufschreiben.');return;}
        for(const line of covered)perform({type:'item.add',itemId:line.item.product.id,product:line.item.product,qty:1},false);
        render();toast(covered.length+' Beispielprodukte mit passenden, geprüften Preisen eingefügt.');
      }
      else if(action==='item-choice')perform({type:'item.choice',itemId:id,mode:b.dataset.mode});
      else if(action==='all-cheapest'){for(const i of activeItems())perform({type:'item.choice',itemId:i.id,mode:'cheapest'},false);render();toast('Günstigste passende Auswahl für alle offenen Produkte aktiviert.');}
      else if(action==='quantity')perform({type:'item.delta',itemId:id,delta:Number(b.dataset.delta)});
      else if(action==='check'){const i=state().items.find(i=>i.id===id);if(i)perform({type:'item.check',itemId:id,checked:!i.checked});}
      else if(action==='remove-item'){perform({type:'item.remove',itemId:id});toast('Produkt entfernt.');}
      else if(action==='toggle-done'){ui.hideDone=!ui.hideDone;render();}
      else if(action==='product')showProduct(id);
      else if(action==='sources'){await refreshCatalog();showSources();}
      else if(action==='refresh-offers')await refreshOffers();
      else if(action==='add-offer')offerForm(id);
      else if(action==='remove-offer'){perform({type:'offer.remove',offerId:id});toast('Eigenes Angebot entfernt.');}
      else if(action==='leaflet-mode'){ui.leafletMode=b.dataset.mode;render();}
      else if(action==='refresh-leaflets'){void refreshLeaflets();}
      else if(action==='week'){ui.weekMode=b.dataset.week;model.weekMode=ui.weekMode;persist();memoKey='';render();}

      else if(action==='select-priced-stores'){const selected=storesWithPrices();perform({type:'settings',settings:{enabledStores:selected}});toast(selected.length+' Märkte mit Preisen ausgewählt.');}
      else if(action==='clear-stores'){perform({type:'settings',settings:{enabledStores:[]}});toast('Marktauswahl geleert. Deine Einkaufsliste bleibt erhalten.');}
      else if(action==='max-stores')perform({type:'settings',settings:{maxStores:Number(b.dataset.value)}});
      else if(action==='recalculate'){memoKey='';render();toast('Plan mit den vorhandenen Daten neu berechnet.');}
      else if(action==='share-list')await shareText(listText(),'Meine Einkaufsliste');
      else if(action==='share-plan')await shareText(planText(),'Mein Einkaufsplan');
      else if(action==='print')window.print();
      else if(action==='backup')backup();
      else if(action==='export-access'){Vault.exportAccess();toast('Zugriffsdatei gespeichert. Bitte privat aufbewahren.');}
      else if(action==='lock-access')Vault.lock();
      else if(action==='import-backup')$('backup-file').click();
      else if(action==='privacy')showPrivacy();
      else if(action==='install'){
        if(window.SparnahInstall){await window.SparnahInstall.install();}
        else openDialog('Sparnah auf deinem Android-Handy',`<p>Öffne die veröffentlichte kostenlose <strong>GitHub-Pages-Webadresse</strong> in Chrome.</p><p>Im Browsermenü <strong>⋮ → „App installieren“ oder „Zum Startbildschirm hinzufügen“</strong> auswählen. Danach startet Sparnah wie eine App.</p><p>Die Einkaufsliste bleibt auf diesem Handy, Angebote werden nach privater Freigabe bei bestehender Internetverbindung aus verschlüsselten Daten aktualisiert. Keine Play-Store-APK.</p><button class="secondary" data-action="close-dialog">Schließen</button>`);
      }
    }catch(e){toast(e.message||'Aktion fehlgeschlagen. Bitte erneut versuchen.');}
  });
  document.addEventListener('input',event=>{
    if(event.target.dataset?.area&&event.target.classList.contains('market-area-label')){const shop=store(ui.layoutStore);if(shop)saveMarketLayout(shop,Shopping.updateArea(marketLayout(shop),event.target.dataset.area,{label:event.target.value}),false);}
    if(event.target.id==='estimate-search'){guideQuery=event.target.value;$('estimate-results').innerHTML=estimateGuideRows();}
    if(event.target.id==='search'){ui.query=event.target.value;ui.searchLimit=24;ui.searchOpen=true;ui.selected=-1;renderSuggestions();}
    if(event.target.id==='offer-search'){ui.offerQuery=event.target.value;const found=offerResults();$('offer-results').innerHTML=offerResultsMarkup(found);$('offer-count').textContent=`${found.length} Angebote erfasst`;$('offer-empty').hidden=!!found.length;}
    if(event.target.id==='brand-search'){ui.brandQuery=event.target.value;ui.brandOpen=true;ui.brandSelected=-1;updateBrandResults();}
    if(event.target.id==='store-search'){ui.storeQuery=event.target.value;$('store-directory').innerHTML=storeRows();}
  });
  document.addEventListener('focusin',event=>{if(event.target.id==='brand-search'){ui.brandOpen=true;renderBrandSuggestions();}if(event.target.id==='search'){ui.searchOpen=true;renderSuggestions();}});
  document.addEventListener('change',event=>{
    const t=event.target;
    if(t.dataset?.item&&t.classList.contains('market-product-area')){const shop=store(ui.layoutStore);if(shop){saveMarketLayout(shop,Shopping.assign(marketLayout(shop),t.dataset.item,t.value));toast('Produkt verschoben. Die Einkaufsliste folgt deinem Marktplan.');}}
    else if(t.dataset?.area&&['market-area-label','market-area-icon','market-area-color'].some(c=>t.classList.contains(c))){const shop=store(ui.layoutStore);if(shop){const field=t.classList.contains('market-area-label')?'label':t.classList.contains('market-area-icon')?'icon':'color';saveMarketLayout(shop,Shopping.updateArea(marketLayout(shop),t.dataset.area,{[field]:t.value}),field!=='label');}}
    else if(t.id==='search-store'||t.id==='search-category'){if(t.id==='search-store')ui.searchStore=t.value;else ui.searchCategory=t.value;ui.searchLimit=24;ui.selected=-1;ui.searchOpen=true;renderSuggestions();}
    else if(t.id==='plan-destination')perform({type:'settings',settings:{targetStoreId:t.value}});
    else if(t.id==='split-days')perform({type:'settings',settings:{allowSplitDays:t.checked}});
    else if(t.id==='photos'){model.photos=t.checked;persist();render();}
    else if(t.classList.contains('store-toggle')){const selected=[...new Set(t.checked?[...state().settings.enabledStores,t.dataset.store]:state().settings.enabledStores.filter(id=>id!==t.dataset.store))];perform({type:'settings',settings:{enabledStores:selected}});}
    else if(t.id==='offer-store'){ui.offerStore=t.value;render();}
    else if(t.id==='brand-store'){ui.brandStore=t.value;render();}
    else if(t.id==='offer-product'){const p=product(t.value);$('offer-title').value=p.title;$('offer-pack').value=p.pack?`${p.pack.min}${p.pack.min===p.pack.max?'':'–'+p.pack.max}`:'';$('offer-unit').value=p.pack?.unit||'g';$('offer-various').checked=!p.variantId;}
    else if(t.id==='offer-shop')$('offer-source').value=store(t.value).url;
    else if(t.id==='backup-file')void importBackup(t.files[0]);
  });
  document.addEventListener('submit',event=>{
    if(event.target.id==='offer-form')saveOffer(event);
    else if(event.target.id==='market-add-area'){event.preventDefault();const shop=store(ui.layoutStore),label=$('market-new-label').value.trim();if(shop&&label){saveMarketLayout(shop,Shopping.addArea(marketLayout(shop),label));toast('Neuer Bereich gespeichert. Verschiebe ihn an die passende Stelle.');}}
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){for(const picker of document.querySelectorAll?.('.store-picker[open]')||[]){picker.open=false;picker.querySelector('summary')?.focus();}}
    if(event.target.id==='brand-search'){
      const choices=brandChoices();
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();ui.brandOpen=true;ui.brandSelected=choices.length?(ui.brandSelected+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length:-1;renderBrandSuggestions();$('brand-option-'+ui.brandSelected)?.scrollIntoView({block:'nearest'});}
      else if(event.key==='Enter'){event.preventDefault();const b=choices[Math.max(0,ui.brandSelected)];if(b)selectBrand(b.name);else{ui.brandOpen=false;renderBrandSuggestions();}}
      else if(event.key==='Escape'){ui.brandOpen=false;renderBrandSuggestions();}
    }else if(event.target.id==='search'){
      const count=findProducts().length+(ui.query.trim()?1:0);
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();ui.searchOpen=true;ui.selected=(ui.selected+(event.key==='ArrowDown'?1:-1)+count)%count;renderSuggestions();$('suggestion-'+ui.selected)?.scrollIntoView({block:'nearest'});}
      else if(event.key==='Enter'&&ui.searchOpen){event.preventDefault();const p=findProducts()[Math.max(0,ui.selected)];if(p)addProduct(p);else document.querySelector('[data-action="custom-product"]')?.click();}
      else if(event.key==='Escape'){ui.searchOpen=false;renderSuggestions();}
    }else if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)&&!$('dialog').open){event.preventDefault();if(ui.tab!=='list')navigate('list');$('search')?.focus();}
  });
  document.addEventListener('load',event=>{if(event.target.tagName==='IMG'&&event.target.naturalWidth>0){const parent=event.target.closest('.thumb');if(parent){parent.classList.add('loaded');parent.setAttribute('aria-label',parent.dataset.imageLabel);const label=parent.querySelector('.thumb-label');if(label)label.textContent=parent.dataset.caption;}}},true);
  document.addEventListener('error',event=>{if(event.target.tagName==='IMG'){const parent=event.target.closest('.thumb');if(parent){parent.classList.add('failed');parent.setAttribute('aria-label','Produktfoto nicht verfügbar; Symbolbild');}}},true);
  $('dialog').addEventListener('click',event=>{if(event.target===$('dialog'))closeDialog();});
  automaticUpdates=window.SparnahUpdates.bind(window,{enabled:()=>state().settings.enabledStores.filter(id=>C.stores.some(st=>st.id===id)),refresh:refreshCatalog,onResume:()=>{memoKey='';render();}});
  window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue){try{const incoming=JSON.parse(event.newValue);if(incoming.base){model=incoming;model.token=null;model.outbox=[];memoKey='';reindex();render();void automaticUpdates.selectionChanged();}}catch{}}});
  let lastDay=E.berlinToday();setInterval(()=>{const today=E.berlinToday();if(today!==lastDay){lastDay=today;memoKey='';render();}},60000);

  function boot(){
    Vault.subscribe(applyPrivateData);
    applyPrivateData(privateData);
  }
  void boot();
})();
