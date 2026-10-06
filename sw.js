/* Highlight Corner service worker — offline app shell, fresh data.
   The deploy workflow stamps the commit SHA into CACHE below, so every
   deploy installs a fresh worker and no stale shell can survive a release. */
const CACHE = 'hc-__BUILD_ID__';
const APP_SHELL = [
  './', 'index.html', 'highlights.html', 'fantasy.html', 'recaps.html',
  'game.html', 'privacy.html', '404.html',
  'css/style.css',
  'js/app.js', 'js/scoreboard.js', 'js/highlights.js', 'js/fantasy.js',
  'js/recaps.js', 'js/game.js', 'js/ads.js',
  'manifest.webmanifest', 'favicon.svg',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Live third-party data and ads: always network, never cache.
  if (/espn\.com|sleeper\.app|googlesyndication\.com|youtube\.com|googleads/.test(url.hostname)) return;

  // Our own data files (recaps etc.): network first, fall back to cache when offline.
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(e.request).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // App shell: cache first, then network (and populate the cache).
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return r;
        })
    )
  );
});
