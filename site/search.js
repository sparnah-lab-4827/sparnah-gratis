/* Indexed, bounded search shared by the UI and backup restoration. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SparnahSearch=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function normalize(value){return String(value??'').toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/(\d)\.(?=\d{3}(?:\D|$))/g,'$1').replace(/(\d)([a-z])/g,'$1 $2').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
  function build(...pools){
    const byId=new Map();
    for(const pool of pools)for(const p of pool||[])if(p&&typeof p.id==='string'&&!byId.has(p.id))byId.set(p.id,p);
    const rows=[...byId.values()].sort((a,b)=>Number(!!b.isGroupChoice)-Number(!!a.isGroupChoice)).map(p=>({p,text:normalize([p.title,p.subtitle,p.brand,p.category,p.keywords,p.line,...(Array.isArray(p.aliases)?p.aliases:[]),p.pack?`${p.pack.min} ${p.pack.max} ${p.pack.unit}`:''].join(' '))}));
    for(const row of rows)row.words=new Set(row.text.split(' '));
    const brands=[...new Set(rows.map(r=>r.p.brand).filter(Boolean))];
    return {byId,products:[...byId.values()],brands,brandRows:brands.map(name=>({name,key:brandKey(name)})).sort((a,b)=>b.key.length-a.key.length),rows,categories:[...new Set(rows.map(r=>r.p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'))};
  }
  function search(index,query,{store='all',category='all',limit=24}={}){
    const terms=normalize(query).split(' ').filter(Boolean),found=[];
    for(const row of index.rows)if((store==='all'||row.p.assortmentStoreId===store)&&(category==='all'||row.p.category===category)&&terms.every(t=>/^\d+$/.test(t)?row.words.has(t):row.text.includes(t)))found.push(row.p);
    return {total:found.length,items:found.slice(0,Math.max(1,limit))};
  }
  function restoreProduct(item,index){
    const p=item?.product;
    if(!p||p.id!==item.id||typeof p.title!=='string'||p.title.length>180||!/^([A-Za-z0-9_:.-]){1,120}$/.test(p.id))throw new Error('Die Sicherung enthält ungültige Produkte.');
    // Keep the chosen snapshot, including its weight, even after catalog changes.
    const independent=(p.id.startsWith('custom:')||p.id.startsWith('assortment:'))&&p.groupId===p.id;
    if(!index.byId.has(p.id)&&!independent)throw new Error('Unbekannte Produktzuordnung in der Sicherung.');
    if(p.pack&&(!['g','ml','St.','Blatt'].includes(p.pack.unit)||!Number.isSafeInteger(p.pack.min)||!Number.isSafeInteger(p.pack.max)||p.pack.min<=0||p.pack.max<p.pack.min||p.pack.max>100000))throw new Error('Ungültige Packungsgröße in der Sicherung.');
    return p;
  }
  function brandKey(value){return normalize(String(value??'').replace(/[’']/g,'')).replace(/\b(?:und|and)\b/g,' ').replace(/\s+/g,' ').trim();}
  function offerBrands(offer,index){
    const p=index.byId.get(offer.productId),explicit=String(offer.brand||p?.brand||'').trim();
    if(explicit)return [explicit];
    const title=String(offer.title||'').replace(/^(?:(?:KNÜLLER|AKTION|TOP[- ]ANGEBOT|ANGEBOT)\s*[:!–-]?\s+)+/iu,'');
    const text=brandKey(title);
    const known=index.brandRows.find(b=>text===b.key||text.startsWith(b.key+' '));
    if(known)return [known.name];
    // Händler setzen Marken häufig an den Titelanfang in Großbuchstaben.
    // Produktbeschreibungen und Suchschlagwörter werden nicht durchsucht.
    const prefix=title.match(/^([\p{Lu}\d][\p{Lu}\d’'!& .-]*)(?=\s+[\p{Lu}][\p{Ll}]|\s+[\p{Ll}]|$)/u)?.[1]?.trim();
    return prefix&&/\p{Lu}{2}/u.test(prefix)?[prefix]:[];
  }
  function brandMatches(offer,index,query){
    const q=brandKey(query);if(!q)return false;
    const terms=q.split(' ');
    return offerBrands(offer,index).some(b=>{
      const words=brandKey(b).split(' ');
      return words.some((_,start)=>terms.every((t,i)=>i===terms.length-1&&t.length>=2?words[start+i]?.startsWith(t):words[start+i]===t));
    });
  }
  function brandOffers(index,offers,query,{engine,weekStart,storeIds,storeId='all'}){
    return offers.filter(o=>(!storeIds||storeIds.includes(o.storeId))&&(storeId==='all'||o.storeId===storeId)&&engine.overlapsWeek(o,weekStart)&&engine.offerUsable(o,Math.max(1,o.minQty||1))&&brandMatches(o,index,query)).sort((a,b)=>a.storeId.localeCompare(b.storeId)||a.title.localeCompare(b.title,'de'));
  }
  function brandSuggestions(index,offers,query,{engine,weekStart,storeIds,storeId='all',limit=12}){
    const names=new Map(),counts=new Map(),q=brandKey(query);
    for(const name of index.brands){const key=brandKey(name);if(key&&!names.has(key))names.set(key,name);}
    for(const offer of offers)for(const name of offerBrands(offer,index)){
      const key=brandKey(name);if(!names.has(key))names.set(key,name);
      if((!storeIds||storeIds.includes(offer.storeId))&&(storeId==='all'||storeId===offer.storeId)&&engine.overlapsWeek(offer,weekStart)&&engine.offerUsable(offer,Math.max(1,offer.minQty||1)))counts.set(key,(counts.get(key)||0)+1);
    }
    return [...names].filter(([key])=>!q||key.includes(q)).map(([key,name])=>({key,name,count:counts.get(key)||0})).sort((a,b)=>Number(b.key===q)-Number(a.key===q)||Number(b.key.startsWith(q))-Number(a.key.startsWith(q))||b.count-a.count||a.name.localeCompare(b.name,'de')).slice(0,limit);
  }
  function assortmentHints(wish,products,{engine,storeIds}){
    const found=new Map();
    for(const p of products){
      if(!p.assortmentStoreId||!p.assortmentSourceUrl||!p.assortmentCheckedAt||storeIds&&!storeIds.includes(p.assortmentStoreId))continue;
      const same=p.id===wish.id||p.groupId===wish.groupId;
      const groups=same?[wish.groupId]:(p.offerGroupIds||[]);
      const m=engine.match(wish,{groupIds:groups,variantIds:p.variantId?[p.variantId]:null,pack:p.pack});
      if(!['exact','group'].includes(m.status))continue;
      if(!found.has(p.assortmentStoreId))found.set(p.assortmentStoreId,{storeId:p.assortmentStoreId,products:[]});
      found.get(p.assortmentStoreId).products.push(p);
    }
    return [...found.values()];
  }
  function reconcileStores(settings,stores){
    // New catalogue entries never opt a user into another market. Keep local choices, including an empty selection.
    const enabled=new Set(Array.isArray(settings.enabledStores)?settings.enabledStores:[]);
    return {...settings,enabledStores:[...enabled],knownStoreIds:stores.map(s=>s.id)};
  }
  function visualProduct(saved,current){
    if(!current?.image||current.id!==saved?.id||saved.variantId&&saved.variantId!==current.variantId)return saved;
    const pack=current.imagePack||current.pack;
    if(saved.pack&&(!pack||pack.unit!==saved.pack.unit||pack.min<saved.pack.min||pack.max>saved.pack.max))return saved;
    return current;
  }
  return {normalize,build,search,restoreProduct,offerBrands,brandMatches,brandOffers,brandSuggestions,assortmentHints,reconcileStores,visualProduct};
});
