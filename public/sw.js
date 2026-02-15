
const CACHE_NAME = 'kasebyar-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map(url => {
          return cache.add(url)
            .then(() => console.log(`SW: Successfully cached ${url}`))
            .catch(err => console.error(`SW: Failed to cache ${url}.`, err));
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin) || event.request.url.startsWith('data:')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
             const responseClone = networkResponse.clone();
             caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
             });
        }
        return networkResponse;
      })
      .catch(() => {
         return caches.match(event.request).then((cachedResponse) => {
             if (cachedResponse) return cachedResponse;
             if (event.request.mode === 'navigate') {
                 return caches.match('/index.html');
             }
             return new Response("Offline", { status: 503, statusText: "Offline" });
         });
      })
  );
});
