// Offline cache: network-first for the app shell so updates arrive, cache fallback when offline.
const CACHE = 'dustbowl-v2';
const FILES = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'js/main.js', 'js/state.js', 'js/util.js', 'js/data.js', 'js/world.js', 'js/art.js', 'js/audio.js', 'js/input.js', 'js/entities.js', 'js/ai.js', 'js/game.js', 'js/render.js', 'js/ui.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok && new URL(e.request.url).origin === location.origin) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request)));
});
