/**
 * Worker personnalisé fusionné dans le Service Worker généré par next-pwa (voir
 * customWorkerSrc dans next.config.ts — next-pwa cherche worker/index.js automatiquement,
 * le compile et l'importe dans le sw.js final via importScripts). Gère la réception des
 * notifications Web Push (Service Worker + VAPID, voir PLAN_NOTIFICATIONS_PUSH.md) —
 * distinct du cache/precaching hors-ligne que next-pwa génère lui-même dans le même fichier.
 */
self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'ZekoulABia';
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data.data || {},
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // ignore malformed push
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/login';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clients) {
        for (const client of clients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      }),
  );
});
