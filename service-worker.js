// Service worker di Gaia's Wake: conserva i file dell'app per l'uso offline.
// Non tocca mai IndexedDB: uscite e foto restano dove sono anche durante gli aggiornamenti.
// Per pubblicare una nuova versione: aumenta VERSION (e APP_VERSION in js/util.js).

const VERSION = '1.1.0';
const CACHE_PREFIX = 'gaias-wake-shell-';
const CACHE = `${CACHE_PREFIX}${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './js/util.js',
  './js/db.js',
  './js/zip.js',
  './js/photos.js',
  './js/backup.js',
  './js/ui.js',
  './js/components.js',
  './js/lake-map.js',
  './js/map-view.js',
  './js/views/home.js',
  './js/views/diario.js',
  './js/views/preferiti.js',
  './js/views/stagione.js',
  './js/views/ricordo.js',
  './js/views/form.js',
  './js/views/backup.js',
  './assets/illustrations/lake-map.webp',
  './assets/textures/paper.webp',
  './assets/icons/icon.svg',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (msg.type === 'GET_STATUS') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      let cached = 0;
      for (const url of SHELL) if (await cache.match(url)) cached++;
      event.ports[0]?.postMessage({ version: VERSION, cached, total: SHELL.length });
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // L'app è una sola pagina: offline si risponde sempre con index.html dalla cache.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cachedPage = await cache.match('./index.html');
      if (cachedPage) return cachedPage;
      return fetch(request);
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  })());
});
