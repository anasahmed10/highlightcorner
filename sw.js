"use strict";
/* Highlight Corner service worker — offline app shell, fresh data.
   The deploy workflow stamps the commit SHA into CACHE below, so every
   deploy installs a fresh worker and no stale shell can survive a release. */
const CACHE = 'hc-__BUILD_ID__';
const worker = self;
const APP_SHELL = [
    './', 'index.html', 'highlights.html', 'fantasy.html', 'recaps.html',
    'game.html', 'privacy.html', '404.html',
    'css/style.css', 'css/utilities.css',
    'js/app.js', 'js/game-pages.js', 'js/scoreboard.js', 'js/highlights.js', 'js/fantasy.js',
    'js/recaps.js', 'js/game.js', 'js/ads.js', 'js/privacy.js', 'js/not-found.js',
    'manifest.webmanifest', 'favicon.svg',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png',
    'icons/ui/list.svg', 'icons/ui/play.svg', 'icons/ui/chart-no-axes-column.svg',
    'icons/ui/notebook-pen.svg', 'icons/ui/settings.svg', 'icons/ui/x.svg',
    'icons/ui/download.svg', 'icons/ui/arrow-left.svg', 'icons/ui/refresh-cw.svg'
];
worker.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => worker.skipWaiting()));
});
worker.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hc-') && k !== CACHE).map((k) => caches.delete(k))))
        .then(() => worker.clients.claim()));
});
async function remember(cache, request, response) {
    if (response.ok) {
        try {
            await cache.put(request, response.clone());
        }
        catch (e) { }
    }
    return response;
}
worker.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET')
        return;
    const url = new URL(e.request.url);
    // All third-party traffic stays on the network, including sports data and ads.
    if (url.origin !== worker.location.origin)
        return;
    if (url.pathname.startsWith('/data/')) {
        e.respondWith((async () => {
            const cache = await caches.open(CACHE);
            try {
                return await remember(cache, e.request, await fetch(e.request));
            }
            catch (error) {
                return await cache.match(e.request) || new Response('{"error":"Offline data unavailable"}', {
                    status: 503, headers: { 'Content-Type': 'application/json' }
                });
            }
        })());
        return;
    }
    e.respondWith((async () => {
        const cache = await caches.open(CACHE);
        // Query strings identify games, while their HTML shell is shared.
        const shellURL = new URL(url.pathname === '/' ? '/index.html' : url.pathname, url.origin).href;
        const navigation = e.request.mode === 'navigate';
        const hit = await cache.match(navigation ? shellURL : e.request);
        if (hit)
            return hit;
        try {
            return await remember(cache, e.request, await fetch(e.request));
        }
        catch (error) {
            if (navigation) {
                if (/^\/game-[0-9]+\.html$/.test(url.pathname)) {
                    const gameShell = await cache.match(new URL('/game.html', url.origin).href);
                    if (gameShell)
                        return gameShell;
                }
                const fallback = await cache.match(new URL('/404.html', url.origin).href);
                if (fallback)
                    return fallback;
            }
            return new Response('You’re offline. Reconnect and try again.', { status: 503 });
        }
    })());
});
