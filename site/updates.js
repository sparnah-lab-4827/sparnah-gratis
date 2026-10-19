/* Refresh published data on resume; keep market choices local. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SparnahUpdates=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function scope(catalog,status,enabled){
    const ids=new Set(enabled||[]),stores=catalog.stores.filter(s=>ids.has(s.id));
    const prices=catalog.offers.filter(o=>ids.has(o.storeId)||(o.applicableStoreIds||[]).some(id=>ids.has(id)));
    const sources=new Map();
    for(const st of stores){
      const key=status?.stores?.[st.id]?st.id:st.retailerId==='aldi'&&prices.some(o=>o.applicableStoreIds?.includes(st.id))?'aldi':null;
      if(key&&status?.stores?.[key])sources.set(key,status.stores[key]);
    }
    const hasNormalPrices=stores.some(s=>s.id==='aldi'||s.retailerId==='aldi');
    const failures=[...sources.values()].filter(s=>s.state==='error').length+(hasNormalPrices&&status?.normalPrices?.state==='error'?1:0);
    return {stores,prices,sources,hasNormalPrices,failures};
  }
  function bind(win,{enabled,refresh,onResume=()=>{}}){
    let previous=new Set(enabled()),pending=null;
    function check(force=true){
      if(win.document.visibilityState!=='visible'||!enabled().length)return Promise.resolve(false);
      if(pending)return pending;
      pending=Promise.resolve().then(()=>refresh(force)).catch(()=>false).finally(()=>{pending=null;});
      return pending;
    }
    function resume(){onResume();return check(true);}
    win.addEventListener('online',()=>void check(true));
    win.addEventListener('pageshow',event=>{if(event.persisted)void resume();});
    win.document.addEventListener('visibilitychange',()=>{if(win.document.visibilityState==='visible')void resume();});
    win.setInterval(()=>void check(false),10*60*1000);
    return {check,selectionChanged(){
      const next=new Set(enabled()),added=[...next].some(id=>!previous.has(id));previous=next;
      return added?check(true):Promise.resolve(false);
    }};
  }
  return {scope,bind};
});
