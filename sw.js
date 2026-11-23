// Offline support: every file the app needs is cached on first visit, so it works with no signal.
// Bump VERSION whenever any file changes, so phones pick up the new version on their next open.
const VERSION = 'quoted-v1';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'fonts/nunito.ttf',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/state.js', 'js/domain.js', 'js/quotes.js', 'js/store.js', 'js/ui.js',
  'js/home.js', 'js/test-screen.js', 'js/learn.js', 'js/other-screens.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first (the app is fully offline); falls back to the network for anything not cached.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true })
    .then((hit) => hit ?? fetch(event.request)));
});
