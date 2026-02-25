// Ein simpler Service Worker, der die App installierbar macht
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installiert');
});

self.addEventListener('fetch', (e) => {
    // Lässt alle Anfragen normal durch, reicht für unser Offline-Speicher-System
});
