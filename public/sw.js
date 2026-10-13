/* =================================================================
   Service worker — PWA offline support + notification taps.

   Caching runs only when registered with ?cache=1 (production), so
   `next dev` hot-reload never gets stale files.
     - /_next/static/*, /icons/*, manifest -> cache-first
     - page navigations           -> network-first, fall back to the
                                     last cached page when offline
     - /api/*                     -> never cached
   ================================================================= */

const CACHE = 'd2d-v1';
const CACHING = new URL(self.location.href).searchParams.get('cache') === '1';
const OFFLINE_HTML =
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Offline</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;' +
  'margin:0;background:#e6f6f1;color:#0f2f2c;text-align:center;padding:24px">' +
  '<div><h1>You’re offline</h1><p>Open the app once while online so it can work offline.</p></div>';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE || !CACHING).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    // Only keep real app pages (not login redirects or errors).
    if (res.ok && !res.redirected) (await caches.open(CACHE)).put('/', res.clone());
    return res;
  } catch {
    return (await caches.match('/')) || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } });
  }
}

self.addEventListener('fetch', (event) => {
  if (!CACHING || event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith(networkFirst(event.request));
  } else if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(cacheFirst(event.request));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    })
  );
});
