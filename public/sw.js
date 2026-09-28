/**
 * Strafe service worker — makes the app installable and gives it a basic offline shell.
 * Deliberately conservative: it only ever touches same-origin GETs (the API, gateway and
 * CDN live on other origins and must never be intercepted), navigations and runtime config
 * are network-first so deploys and config changes take effect immediately, and hashed
 * static assets are cache-first. Bump CACHE to force old caches out on the next visit.
 */
const CACHE = 'strafe-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch API / gateway / CDN

  const isNavigation = req.mode === 'navigate';
  const isConfig = url.pathname === '/config.js';

  if (isNavigation || isConfig) {
    // Network-first so a new deploy / config is picked up at once; fall back to cache offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(isNavigation ? '/' : req, copy));
          return res;
        })
        .catch(() => caches.match(isNavigation ? '/' : req).then((r) => r || Response.error())),
    );
    return;
  }

  // Hashed static assets: serve from cache, fall back to network and populate the cache.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
