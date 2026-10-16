/* Keine Offline-Caches für vertrauliche Kalenderseiten oder Nutzerdaten.
   Alte Cache-First-Serviceworker werden beim nächsten Besuch ersetzt. */
self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names=await caches.keys();
        await Promise.all(names.map(name=>caches.delete(name)));
        await self.registration.unregister();
        await self.clients.claim();
    })());
});
// Absichtlich kein fetch-Handler: Alle geschützten Anfragen gehen direkt zum Server.
