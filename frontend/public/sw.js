// Service Worker - NO-OP version
// This unregisters any old broken service workers and does nothing else
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(names.map(name => caches.delete(name)));
    }).then(() => clients.claim()).then(() => {
      return self.registration.unregister();
    })
  );
});
