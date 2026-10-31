// Simple service worker for basic caching
const CACHE_NAME = 'iksi-v1';
const STATIC_ASSETS = [
  '/',
  '/app.css',
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  // Cache-first strategy for static assets
  if (event.request.url.includes('_app/') || 
      event.request.url.includes('favicon') ||
      event.request.url.includes('manifest.json')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
  }
});
