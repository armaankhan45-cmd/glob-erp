const V = 'glob-erp-v1';
const SHELL = V + '-shell', ASSETS = V + '-assets', DATA = V + '-data';
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    try {
      const html = await (await fetch('/', { cache: 'reload' })).text();
      await c.put('/', new Response(html, { headers: { 'Content-Type': 'text/html' } }));
      const urls = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]))];
      const a = await caches.open(ASSETS);
      await Promise.all(urls.map(u => a.add(u).catch(() => {})));
    } catch (_) {}
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(V)) await caches.delete(k);
    await self.clients.claim();
  })());
});
const SKIP = /\/(ping|auth|export)(\/|\?|$)/;
self.addEventListener('message', e => { if (e.data === 'purge-data') caches.delete(DATA); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') {
    // any mutation invalidates cached API data so lists never show stale rows
    if (url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com')) e.waitUntil(caches.delete(DATA));
    return;
  }
  const isApi = url.pathname.startsWith('/api/') || url.hostname.includes('onrender.com');
  if (isApi) {
    if (SKIP.test(url.pathname)) return;
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(DATA)).put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await caches.match(req, { cacheName: DATA });
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }
  if (url.origin !== location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
      e.respondWith(caches.match(req).then(h => h || fetch(req).then(r => { caches.open(ASSETS).then(c => c.put(req, r.clone())); return r; })));
    }
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        (await caches.open(SHELL)).put('/', res.clone());
        return res;
      } catch (_) { return (await caches.match('/', { cacheName: SHELL })) || Response.error(); }
    })());
    return;
  }
  if (url.pathname.startsWith('/assets/') || /\.(png|ico|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then(h => h || fetch(req).then(r => { if (r.ok) caches.open(ASSETS).then(c => c.put(req, r.clone())); return r; })));
  }
});
