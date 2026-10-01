const CACHE_NAME = 'makam-repertuari-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;

  const sameOrigin = new URL(req.url).origin === self.location.origin;

  if(sameOrigin){
    // Kendi sayfamız (uygulama kabuğu): önbellekten anında sun, arka planda tazele.
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if(res && res.ok){
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Dış sitelerdeki nota PDF'leri: sadece "Notayı Aç" ile aynı sekmede yapılan
  // sayfa geçişlerini (navigate) ele alıyoruz — GitHub API/data.json gibi normal
  // fetch() çağrılarına dokunmuyoruz, onlar her zaman doğrudan ağa gidiyor.
  if(req.mode === 'navigate' || req.destination === 'iframe' || req.destination === 'document'){
    event.respondWith(
      caches.match(req, { ignoreVary: true, ignoreSearch: true }).then((cached) => {
        if(cached) return cached;
        return fetch(req).then((res) => {
          if(res && (res.ok || res.type === 'opaque')){
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => new Response(
          `<html><body style="background:#17130f;color:#c9a24b;font-family:sans-serif;text-align:center;padding:2.5rem 1.2rem;">
            Bu nota offline için kaydedilmemiş.<br>İnternete bağlanınca tekrar dene ya da önceden "Offline için kaydet"e bas.
          </body></html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        ));
      })
    );
  }
});
