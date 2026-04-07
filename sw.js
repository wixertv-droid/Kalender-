const CACHE_NAME = 'agenda-2050-cache-v7';

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Zwingt den Service Worker, sich sofort zu aktualisieren
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache); // Löscht alte Caches
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // 🚨 ANTI-CACHE-FESTUNG: Supabase API NIEMALS cachen! Immer live durchlassen!
    if (event.request.url.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Für alle anderen Dateien (HTML, CSS, JS, Bilder): Netzwerk zuerst, dann Fallback auf Cache
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
