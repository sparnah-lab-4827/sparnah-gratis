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
  return {project};
});
