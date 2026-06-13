const CACHE = 'yatzy-v4';
const ASSETS = [
    './',
    'index.html',
    'css/theme.css',
    'css/layout.css',
    'css/dice.css',
    'css/scorecard.css',
    'js/game.js',
    'js/undo.js',
    'js/dice.js',
    'js/ai.js',
    'js/ui.js',
    'manifest.json',
    'icons/favicon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png'
];

// Install: cache all assets
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request)
            .then(resp => {
                // Only cache successful responses so a bad deploy can't poison the cache
                if (resp && resp.ok && resp.type !== 'opaque') {
                    const clone = resp.clone();
                    caches.open(CACHE).then(cache => cache.put(e.request, clone));
                }
                return resp;
            })
            .catch(() => caches.match(e.request))
    );
});
