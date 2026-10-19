/* Capture the browser's install offer before private data is unlocked. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.SparnahInstall=api.create(root);api.bind(root,root.SparnahInstall);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create(win){
    let pending=null,busy=false,installed=!!(win.matchMedia?.('(display-mode: standalone)').matches||win.navigator?.standalone);
    const listeners=new Set();
    const notify=()=>{for(const fn of listeners)fn({installed,available:!!pending});};
    win.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event;notify();});
    win.addEventListener('appinstalled',()=>{installed=true;pending=null;notify();});
    return {
      isInstalled:()=>installed,
      subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
      async request(){
        if(installed)return {outcome:'installed'};
        if(busy)return {outcome:'busy'};
        if(!pending)return {outcome:'instructions'};
        const event=pending;pending=null;busy=true;notify();
        try{
          // Called directly from the click, while the browser's user gesture is active.
          await event.prompt();
          const choice=await event.userChoice;
          return {outcome:choice?.outcome==='accepted'?'accepted':'dismissed'};
        }catch{return {outcome:'instructions'};}
        finally{busy=false;notify();}
      }
    };
  }
  function bind(win,controller){
    const doc=win.document,dialog=doc.getElementById('install-dialog'),message=doc.getElementById('install-message');
    function show(text){message.textContent=text;dialog.showModal();}
    controller.install=async()=>{
      const result=await controller.request();
      if(result.outcome==='instructions')show('Öffne Sparnah auf deinem Android-Handy in Chrome. Tippe oben auf ⋮ und dann auf „Installieren und Verknüpfung erstellen“ → „Installieren“. Je nach Chrome-Version heißt der Menüpunkt auch „App installieren“ oder „Zum Startbildschirm hinzufügen“. Danach findest du Sparnah als Symbol auf deinem Handy.');
      else if(result.outcome==='installed')show('Sparnah ist auf diesem Gerät bereits als App geöffnet.');
      else if(result.outcome==='accepted')show('Die Installation wurde angefordert. Folge gegebenenfalls noch dem Hinweis von Chrome. Öffne Sparnah danach über das neue Symbol auf deinem Gerät.');
      return result;
    };
    doc.getElementById('install-open').addEventListener('click',()=>void controller.install());
    doc.getElementById('install-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
    function update(){
      const button=doc.getElementById('install-open');
      button.hidden=controller.isInstalled();
    }
    controller.subscribe(update);update();
  }
  return {create,bind};
});
