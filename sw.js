// Сайт переехал на https://daria.vosiev.com
// Этот сервис-воркер самоликвидируется: чистит кэш и отписывается,
// чтобы у вернувшихся посетителей открылась актуальная страница (без старого кэша).
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
    try { await self.registration.unregister(); } catch (e) {}
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => { try { c.navigate(c.url); } catch (e) {} });
  })());
});

// Без кэша — всё идёт напрямую в сеть.
self.addEventListener('fetch', () => {});
