/**
 * Strafe service worker.
 *
 * It deliberately does NOT cache application code. Everything hashed under /assets/ is
 * already immutable-cached by the browser via nginx headers, and index.html / config.js are
 * served no-cache, so the browser + server handle deploys correctly on their own. A service
 * worker that also cached the bundle is exactly what makes "every deploy breaks the app until
 * I clear site data" happen — a stale cached shell or chunk survives a normal reload. So this
 * worker exists only to keep the app installable (Add to Home Screen needs a fetch handler):
 * it passes navigations straight to the network with a tiny offline fallback, and leaves
 * every other request entirely to the browser.
 *
 * On activate it deletes every cache from any earlier version of this worker, which heals
 * clients that were stuck on a previously cached build.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const OFFLINE_HTML =
  '<!doctype html><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>' +
  '<body style="margin:0;height:100vh;display:grid;place-items:center;background:#101216;color:#e6e6e6;' +
  'font-family:system-ui,-apple-system,sans-serif">' +
  '<p style="opacity:.8">You’re offline — reconnect and reload.</p>';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Only take over top-level navigations (so we count as a fetch handler and stay
  // installable). Network-first with a plain offline page — never a cached bundle. Every
  // other request (assets, config, API, CDN) is left to the browser untouched.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(
        () => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
      ),
    );
  }
});
