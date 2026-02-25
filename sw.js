const CACHE_NAME = 'agenda-2050-v1';
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

// Installation: Dateien in den Cache laden
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Aktivierung: Alte Caches löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// Strategie: Erst im Cache suchen, dann Netzwerk (Offline-First)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
