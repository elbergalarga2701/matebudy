const CACHE_NAME = 'matebudy-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/index-B683oLRI.css',
  '/assets/index-D-rNWaxj.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first for API calls, cache-first for static assets
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'MateBudy', body: 'Tienes una novedad en la app.' };
  try {
    payload = event.data ? event.data.json() : payload;
  } catch (error) {
    // si no llega JSON usamos el payload por defecto
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'MateBudy', {
      body: payload.body || 'Tienes una novedad en la app.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.url || '/',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return null;
    }),
  );
});
