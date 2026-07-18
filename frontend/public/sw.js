self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(n => Promise.all(n.map(k => caches.delete(k)))).then(() => clients.claim()).then(() => self.registration.unregister())
  );
});
