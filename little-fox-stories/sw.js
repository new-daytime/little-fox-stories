// Little Fox Stories service worker: always try the network first (so updates show up right away),
// fall back to the last saved copy when offline.
const CACHE='fox-v1';
self.addEventListener('install',e=>{ self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./canyon.html','./cloud.js','./icon-192.png']).catch(()=>{}))); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{ const r=e.request; if(r.method!=='GET') return; const u=new URL(r.url);
  const mine=u.origin===location.origin, cdn=/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u.host);
  if(!mine&&!cdn) return; if(mine&&u.pathname.endsWith('version.json')) return;
  e.respondWith(fetch(r).then(res=>{ if(res&&(res.ok||res.type==='opaque')){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(mine?new Request(u.origin+u.pathname):r,copy)); } return res; })
    .catch(()=>caches.match(mine?new Request(u.origin+u.pathname):r).then(m=>m||caches.match('./index.html')))); });
