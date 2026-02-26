const CACHE_NAME = 'agenda-2050-v2'; // <--- Das v2 ist der Schlüssel!
const ASSETS = [
  './',
  './index.html',
  './woche.html',
  './jahr.html',
  './kunden.html',
  './einstellungen.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Zwingt den neuen Worker, sofort zu starten
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim(); // Übernimmt sofort die Kontrolle
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
