const CACHE_NAME = 'family-dashboard-v1';
const ASSETS = [
  '/home/',
  '/home/index.html',
  '/home/styles.css',
  '/home/app.js',
  '/home/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});