/* Offline cache for the app shell (all data lives in IndexedDB on the device). */
const VER='petcare-v4';
const SHELL=['./','index.html','css/style.css','js/species.js','js/db.js','js/platform.js','js/core.js','js/pets.js','js/track.js','js/care.js','js/passport.js','js/summary.js','js/sos.js','js/home.js','js/boot.js','vendor/qrcode.js','vendor/jspdf.umd.min.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(VER).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VER).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{ const u=new URL(e.request.url); if(e.request.method!=='GET'||u.origin!==location.origin) return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).catch(()=>caches.match('index.html')))); });
self.addEventListener('notificationclick',e=>{ e.notification.close(); e.waitUntil(self.clients.matchAll({type:'window'}).then(cs=>cs.length?cs[0].focus():self.clients.openWindow('./index.html#care'))); });
