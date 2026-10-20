/* Indexed, bounded search shared by the UI and backup restoration. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SparnahSearch=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function normalize(value){return String(value??'').toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/(\d)\.(?=\d{3}(?:\D|$))/g,'$1').replace(/(\d)([a-z])/g,'$1 $2').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
  function build(...pools){
    const byId=new Map();
    for(const pool of pools)for(const p of pool||[])if(p&&typeof p.id==='string'&&!byId.has(p.id))byId.set(p.id,p);
    const rows=[...byId.values()].sort((a,b)=>Number(!!b.isGroupChoice)-Number(!!a.isGroupChoice)).map((p,order)=>{
      const pack=p.pack?`${p.pack.min} ${p.pack.max} ${p.pack.unit}`:'';
      const title=normalize(p.title),primary=normalize([p.title,p.brand,p.line,...(Array.isArray(p.aliases)?p.aliases:[]),pack].join(' '));
      // Imported keywords may repeat a department such as "Milk & Eggs". A department
      // is a filter, not evidence that every product in it contains the searched food.
      const category=normalize(p.category),keywords=normalize(p.keywords);
      const cleanedKeywords=category?keywords.split(category).join(' '):keywords;
      const text=normalize([primary,p.subtitle,cleanedKeywords].join(' '));
      const generic=!!(!p.variantId&&!p.brand&&p.groupId&&!/^(?:assortment|import|manufacturer|custom):/.test(p.id));
      const general=!!(p.isGroupChoice||p.groupSelection||generic);
      return {p,order,title,primary,text,generic,general,words:new Set(text.split(' ')),primaryWords:new Set(primary.split(' ')),titleWords:new Set(title.split(' '))};
    });
    const brands=[...new Set(rows.map(r=>r.p.brand).filter(Boolean))];
    return {byId,products:[...byId.values()],brands,brandRows:brands.map(name=>({name,key:brandKey(name)})).sort((a,b)=>b.key.length-a.key.length),rows,categories:[...new Set(rows.map(r=>r.p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'))};
  }
  function search(index,query,{store='all',category='all',limit=24}={}){
    const terms=normalize(query).split(' ').filter(Boolean),found=[];
    const matches=(text,words)=>terms.every(t=>/^\d+$/.test(t)?words.has(t):text.includes(t));
    // A global wish is a shopping intention, not evidence of a retailer's stock.
    // Keep it available with a source filter; actual catalogue entries stay scoped.
    for(const row of index.rows)if((store==='all'||row.p.assortmentStoreId===store||(row.generic||row.p.referenceWish===true)&&!row.p.assortmentStoreId)&&(category==='all'||row.p.category===category)&&matches(row.text,row.words)){
      const direct=matches(row.primary,row.primaryWords);
      const titleHits=terms.reduce((score,t)=>score+Math.max(0,...[...row.titleWords].map(w=>w===t?4:w.startsWith(t)?3:w.endsWith(t)?2:w.includes(t)?1:0)),0);
      const exactPack=!!(row.p.pack&&row.p.pack.min===row.p.pack.max&&terms.includes(String(row.p.pack.min)));
      found.push({row,tier:direct?(row.generic?0:row.general?1:2):3,titleHits,exactPack});
    }
    // Rank before pagination, so a general wish cannot disappear behind a large catalogue.
    // A brand/variant query still needs its own match; unrelated broad wishes never get pinned.
    if(terms.length)found.sort((a,b)=>a.tier-b.tier||Number(b.exactPack)-Number(a.exactPack)||b.titleHits-a.titleHits||a.row.order-b.row.order);
    return {total:found.length,items:found.slice(0,Math.max(1,limit)).map(hit=>hit.row.p)};
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
  function createBrandSearch(index,offers){
    const copyOffer=o=>({...o,...(o.pack?{pack:{...o.pack}}:{}),
      ...(Array.isArray(o.groupIds)?{groupIds:[...o.groupIds]}:{}),
      ...(Array.isArray(o.variantIds)?{variantIds:[...o.variantIds]}:{}),
      ...(Array.isArray(o.applicableStoreIds)?{applicableStoreIds:[...o.applicableStoreIds]}:{})});
    const names=new Map();
    for(const name of index.brands){const key=brandKey(name);if(key&&!names.has(key))names.set(key,name);}
    // Immutable identity/filter snapshots: construct a new instance after catalogue
    // or price updates. Query text never creates persistent cache entries.
    const rows=offers.map(original=>{
      const brands=offerBrands(original,index).map(name=>{const key=brandKey(name);return {name,key,words:key.split(' ')};});
      for(const {name,key} of brands)if(!names.has(key))names.set(key,name);
      return {offer:copyOffer(original),brands};
    });
    const byEngine=new WeakMap();
    function context({engine,weekStart,storeIds,storeId='all'}){
      let cache=byEngine.get(engine);if(!cache){cache=new Map();byEngine.set(engine,cache);}
      const key=JSON.stringify([weekStart,storeIds||null,storeId]);
      if(cache.has(key)){
        const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;
      }
      const enabled=storeIds?new Set(storeIds):null,eligible=[],counts=new Map();
      for(const row of rows){
        const o=row.offer;
        if(enabled&&!enabled.has(o.storeId)||(storeId!=='all'&&storeId!==o.storeId)||
          !engine.overlapsWeek(o,weekStart)||!engine.offerUsable(o,Math.max(1,o.minQty||1)))continue;
        eligible.push(row);
        for(const {key}of row.brands)counts.set(key,(counts.get(key)||0)+1);
      }
      const value={eligible,counts};cache.set(key,value);
      if(cache.size>8)cache.delete(cache.keys().next().value);
      return value;
    }
    return {
      brandOffers(query,options){
        const q=brandKey(query);if(!q)return [];
        const terms=q.split(' '),{eligible}=context(options);
        return eligible.filter(row=>row.brands.some(({words})=>words.some((_,start)=>
          terms.every((t,i)=>i===terms.length-1&&t.length>=2?words[start+i]?.startsWith(t):words[start+i]===t))))
          .map(row=>copyOffer(row.offer)).sort((a,b)=>a.storeId.localeCompare(b.storeId)||a.title.localeCompare(b.title,'de'));
      },
      brandSuggestions(query,options){
        const q=brandKey(query),{counts}=context(options),limit=options.limit===undefined?12:options.limit;
        return [...names].filter(([key])=>!q||key.includes(q)).map(([key,name])=>({key,name,count:counts.get(key)||0}))
          .sort((a,b)=>Number(b.key===q)-Number(a.key===q)||Number(b.key.startsWith(q))-Number(a.key.startsWith(q))||b.count-a.count||a.name.localeCompare(b.name,'de')).slice(0,limit);
      }
    };
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
  function createAssortmentHints(assortment,{choices,products=assortment,engine}){
    const byProduct=new WeakMap(),byGroup=new Map(),byId=new Map();
    const add=(map,key,row)=>{if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(row);};
    const signature=p=>JSON.stringify(p);
    const rows=(assortment||[]).filter(p=>p&&p.assortmentStoreId&&p.assortmentSourceUrl&&p.assortmentCheckedAt)
      .map((original,order)=>({original,order,signature:signature(original)}));
    // These price-free objects exist only to reuse vetted catalogue identities.
    // They are never returned as offers, prices, stock or source verification.
    const inputs=rows.map(({original:p})=>({...p,productId:p.id,
      groupIds:[...new Set([p.groupId,...(p.offerGroupIds||[])].filter(Boolean))],
      variantIds:p.variantId?[p.variantId]:null,pack:p.pack&&{...p.pack},verification:'source'}));
    const annotated=choices.annotateOffers(inputs,products);
    rows.forEach((row,i)=>{
      const linked=annotated[i],p=row.original;
      row.evidence={groupIds:[...(linked.groupIds||[])],variantIds:linked.variantIds?[...linked.variantIds]:null,
        pack:linked.pack&&{...linked.pack},packUnconfirmed:linked.packUnconfirmed};
      byProduct.set(p,row);add(byId,p.id,row);
      for(const group of new Set([p.groupId,...row.evidence.groupIds]))add(byGroup,group,row);
    });
    function matchWith(wish,p,matchingEngine){
      const row=p&&byProduct.get(p);
      // A copied, injected or subsequently edited record is not part of this
      // prepared snapshot. Rebuild after any catalogue update.
      if(!wish||!row||signature(p)!==row.signature)return {status:'none'};
      const same=p.id===wish.id||p.groupId===wish.groupId;
      return matchingEngine.match(wish,{...row.evidence,
        groupIds:same?[...new Set([wish.groupId,...row.evidence.groupIds])]:row.evidence.groupIds});
    }
    return {
      match:(wish,p)=>matchWith(wish,p,engine),
      assortmentHints(wish,{engine:matchingEngine=engine,storeIds}={}){
        if(!wish)return [];
        const candidates=[...new Set([...(byId.get(wish.id)||[]),...(byGroup.get(wish.groupId)||[])])]
          .sort((a,b)=>a.order-b.order),found=new Map(),enabled=storeIds?new Set(storeIds):null;
        for(const {original:p}of candidates){
          if(enabled&&!enabled.has(p.assortmentStoreId))continue;
          if(!['exact','group'].includes(matchWith(wish,p,matchingEngine).status))continue;
          if(!found.has(p.assortmentStoreId))found.set(p.assortmentStoreId,{storeId:p.assortmentStoreId,products:[]});
          found.get(p.assortmentStoreId).products.push(p);
        }
        return [...found.values()];
      }
    };
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
  return {normalize,build,search,restoreProduct,offerBrands,brandMatches,brandOffers,brandSuggestions,createBrandSearch,assortmentHints,createAssortmentHints,reconcileStores,visualProduct};
});
