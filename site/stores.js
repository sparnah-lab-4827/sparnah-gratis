/* One displayed shop per retailer; price applicability remains branch-specific. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SparnahStores=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const labels={aldi:'ALDI',rewe:'REWE',edeka:'EDEKA',kaufland:'Kaufland',lidl:'Lidl',netto:'Netto',norma:'NORMA',denns:'Denns',ebl:'ebl',mixmarkt:'Mix Markt',fraenky:'Fränky',fristo:'FRISTO'};
  function project(catalog,settings={},engine){
    const groups=new Map(),aliases={};
    for(const store of catalog.stores){const key=store.retailerId||store.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(store);}
    const enabled=new Set(settings.enabledStores||[]);
    const stores=[...groups].map(([key,branches])=>{
      const chosen=branches.find(s=>s.preferredDisplay===true)||branches.find(s=>s.id===settings.targetStoreId)||branches.find(s=>enabled.has(s.id))||branches[0];
      for(const branch of branches)aliases[branch.id]=chosen.id;
      return {...chosen,name:labels[key]||chosen.name.split(/\s+[–—]\s+/)[0],short:labels[key]||chosen.short};
    });
    const ids=new Set(stores.map(s=>s.id));
    // Expansion copies only explicitly evidenced applicableStoreIds. Do not move
    // an exclusive offer from a hidden branch onto the representative branch.
    const offers=engine.expandOffers(catalog.offers,catalog.stores).filter(o=>ids.has(o.storeId));
    return {catalog:{...catalog,stores,offers},aliases,settings:{...settings,
      enabledStores:[...new Set([...enabled].map(id=>aliases[id]||id))],
      targetStoreId:settings.targetStoreId?aliases[settings.targetStoreId]||settings.targetStoreId:settings.targetStoreId,
      knownStoreIds:stores.map(s=>s.id)}};
  }
  function projectAssortment(assortment,stores){
    // This audited importer reads ALDI SÜD's public category catalogue, without
    // a selected branch. This is catalogue identity, never local stock or price.
    const official=value=>{
      try{
        const u=new URL(value);
        return u.protocol==='https:'&&u.hostname==='www.aldi-sued.de'&&!u.username&&!u.password&&!u.port&&!u.hash?u:null;
      }catch{return null;}
    };
    const source=official(assortment?.sources?.aldi?.sourceUrl);
    const targets=(stores||[]).filter(s=>s.retailerId==='aldi'&&official(s.url));
    if(!source||source.pathname!=='/produkte'||source.search||targets.length!==1)return assortment;
    const target=targets[0],products=(assortment.products||[]).map(p=>{
      if(p.assortmentStoreId!=='aldi'||p.availabilityConfirmed!==false||
        p.assortmentScope||p.scope||p.assortmentSourceStoreId||p.branchId||p.assortmentBranchId||
        p.storeId||p.applicableStoreIds||(p.retailerId&&p.retailerId!=='aldi'))return p;
      const product=official(p.assortmentSourceUrl),page=official(p.sourcePage),sku=String(p.retailerProductId||'');
      if(!/^\d+$/.test(sku)||!String(p.id||'').startsWith('assortment:aldi:'+sku+':')||
        !product||product.search||!product.pathname.startsWith('/produkt/')||!product.pathname.endsWith('-'+sku)||
        !page||!/^\/produkte\/(?:[^/]+\/)+k\/\d+\/?$/.test(page.pathname)||
        [...page.searchParams].some(([key,value])=>key!=='page'||!/^[1-9]\d*$/.test(value))||
        page.searchParams.getAll('page').length>1)return p;
      return {...p,assortmentStoreId:target.id,assortmentSourceStoreId:p.assortmentStoreId,
        assortmentScope:'retailer-catalog',assortmentRetailerId:'aldi'};
    });
    return {...assortment,products};
  }
  return {project,projectAssortment};
});
