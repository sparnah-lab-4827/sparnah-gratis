/* Only dated, non-expired leaflets for the selected markets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SparnahLeaflets=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
  function select(data,stores,enabled,{today,mode='today',engine}){
    const ids=new Set(enabled),weekEnd=engine.addDays(engine.mondayOf(today),6);
    return (data.leaflets||[]).filter(p=>validDate(p.start)&&validDate(p.end)&&p.start<=p.end&&p.end>=today&&p.start<=(mode==='week'?weekEnd:today)&&p.dateProof&&p.checkedAt&&/^https:\/\//.test(p.viewerUrl||'')).map(p=>({...p,stores:stores.filter(s=>ids.has(s.id)&&(s.id===p.storeId||(p.scopeType==='national'&&p.retailerId&&s.retailerId===p.retailerId)))})).filter(p=>p.stores.length).sort((a,b)=>a.stores[0].name.localeCompare(b.stores[0].name,'de')||a.start.localeCompare(b.start));
  }
  return {validDate,select};
});
