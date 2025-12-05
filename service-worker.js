const CACHE_NAME = 'desengany-v1';
const urlsToCache = [
  '/Desengany/',
  '/Desengany/index.html',
  'https://raw.githubusercontent.com/pensamientoincansable/Desengany/main/media/images/desengany.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
