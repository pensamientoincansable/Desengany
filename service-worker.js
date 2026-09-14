/* ═══════════════════════════════════════════════════════════════════════
   DESSENGANY · service worker
   Estrategia:
     · Navegación  → red primero, caché como respaldo (siempre al día).
     · Medios      → caché primero con revalidación en segundo plano:
                     son pesados (vídeo/audio) y no cambian nunca en la URL.
     · Tipografías → caché permanente (inmutables por URL con versionado).
   El espacio se limita con una poda por LRU.
   ═══════════════════════════════════════════════════════════════════════ */
const VERSION = 'desengany-v2';
const SHELL = ['index.html', 'manifest.json'];
const MAX_MEDIA_ENTRIES = 40;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isMedia = /\.(mp4|webm|gif|webp|jpe?g|png|mp3|wav|ogg|m4a)(\?|$)/i.test(url.pathname);
  const isFont = url.hostname === 'fonts.gstatic.com' || /fontawesome|font-awesome/i.test(url.hostname + url.pathname);

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

  if (!isMedia && !isFont && url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const refresh = fetch(req)
        .then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(VERSION)
              .then(c => c.put(req, copy).then(() => prune(c)))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});

/* Poda simple: no dejar la caché de medios crecer sin control. */
function prune(cache) {
  if (!cache.keys) return Promise.resolve();
  return cache.keys().then(keys => {
    if (keys.length <= MAX_MEDIA_ENTRIES) return;
    const drop = keys.slice(0, keys.length - MAX_MEDIA_ENTRIES)
      .filter(k => !/index\.html|manifest\.json/.test(k.url));
    return Promise.all(drop.map(k => cache.delete(k)));
  }).catch(() => {});
}
