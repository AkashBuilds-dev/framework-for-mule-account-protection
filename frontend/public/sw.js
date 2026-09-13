const CACHE = 'mst-field-terminal-v1';
const SHELL = ['/field', '/', '/index.html', '/manifest.json', '/field-shield.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/field')))
  );
});
function cacheAlerts(alerts) {
  const open = indexedDB.open('mst-field-alerts', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('alerts', { keyPath: 'dispatch_id' });
  open.onsuccess = () => {
    const db = open.result; const transaction = db.transaction('alerts', 'readwrite'); const store = transaction.objectStore('alerts');
    store.clear(); alerts.slice(0, 20).forEach(alert => store.put(alert));
  };
}
self.addEventListener('message', event => { if (event.data?.type === 'CACHE_ALERTS') { const alerts = event.data.alerts || []; cacheAlerts(alerts); const request = new Request('/__mst_last_alerts__'); const response = new Response(JSON.stringify(alerts.slice(0, 20)), { headers: { 'Content-Type': 'application/json' } }); caches.open(CACHE).then(cache => cache.put(request, response)); } });
