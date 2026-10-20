/* Offline shell only. Authenticated ciphertext is stored by vault.js in IndexedDB. */
const CACHE='sparnah-free-shell-v24-marktauswahl';
const VERSION='20261020-marktauswahl';
const FILES=['index.html','styles.css','engine.js','search.js','leaflets.js','choices.js','stores.js','selection.js','vault.js','install.js','updates.js','app.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
const ASSETS=['./',...FILES.map(path=>/\.(js|css)$/.test(path)?path+'?v='+VERSION:path)];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('sparnah-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url),scope=new URL(self.registration.scope);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  const path=url.pathname.slice(scope.pathname.length);
  // Never intercept data, remote images, or former plaintext catalog endpoints.
  if(path!==''&&!FILES.includes(path))return;
  event.respondWith(fetch(event.request,{cache:'no-cache'}).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(()=>caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreSearch:true}).then(cached=>cached||(event.request.mode==='navigate'?cache.match('index.html'):Response.error())))));
});
