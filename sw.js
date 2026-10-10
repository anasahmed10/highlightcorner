"use strict";
/* Highlight Corner service worker — offline app shell, fresh data.
   The deploy workflow stamps the commit SHA below, so each release fetches
   fresh shell assets before activating its cache. */
const BUILD_ID = '__BUILD_ID__';
const CACHE = 'hc-' + BUILD_ID;
const worker = self;
const APP_SHELL = [
    './', 'index.html', 'highlights.html', 'fantasy.html', 'recaps.html',
    'game.html', 'privacy.html', '404.html',
    'css/style.css', 'css/utilities.css',
    'js/app.js', 'js/game-pages.js', 'js/scoreboard.js', 'js/highlights.js', 'js/fantasy.js',
    'js/recaps.js', 'js/game.js', 'js/ads.js', 'js/privacy.js', 'js/not-found.js',
    'manifest.webmanifest', 'favicon.svg',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
    'icons/brand-mark.svg',
    'icons/apple-touch-icon.png',
    'icons/ui/list.svg', 'icons/ui/play.svg', 'icons/ui/chart-no-axes-column.svg',
    'icons/ui/notebook-pen.svg', 'icons/ui/settings.svg', 'icons/ui/x.svg',
    'icons/ui/download.svg', 'icons/ui/arrow-left.svg', 'icons/ui/refresh-cw.svg'
];
worker.addEventListener('install', (e) => {
    e.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        try {
            const results = await Promise.allSettled(APP_SHELL.map(async (asset) => {
                const canonical = new URL(asset, worker.registration.scope);
                const releaseURL = new URL(canonical);
                releaseURL.searchParams.set('__hc_build', BUILD_ID);
                // The active worker may serve plain shell URLs from its old cache.
                const response = await fetch(new Request(releaseURL, { cache: 'reload' }));
                if (!response.ok)
                    throw new Error(`Could not cache ${asset}: ${response.status}`);
                await cache.put(canonical.href, response);
            }));
            const failure = results.find((result) => result.status === 'rejected');
            if (failure)
                throw failure.reason;
            await worker.skipWaiting();
        }
        catch (error) {
            await caches.delete(CACHE);
            throw error;
        }
    })());
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
