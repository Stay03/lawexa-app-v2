/* Firebase Cloud Messaging service worker — closed-app push.
 *
 * Served from the site root so it controls the whole origin. `getToken()`
 * auto-registers this file. The config is inlined because a static service
 * worker cannot read build-time env vars — these are the client-public Firebase
 * values (the same NEXT_PUBLIC_* config the app ships), not secrets. Keep the
 * compat CDN version in sync with the `firebase` npm package (12.16.0). */

importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD644O9KghRmKOSnooBnJtkScKVwr7yTJ8',
  authDomain: 'lawexa-80a3c.firebaseapp.com',
  projectId: 'lawexa-80a3c',
  storageBucket: 'lawexa-80a3c.firebasestorage.app',
  messagingSenderId: '365859943014',
  appId: '1:365859943014:web:da25ea79b56f6426dfb3a7',
});

const messaging = firebase.messaging();

// Fires only when the app is closed / not focused. The backend sends the copy in
// the `data` payload (with a `url` deep link); fall back to `notification` fields.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = data.title || notification.title || 'Lawexa';
  self.registration.showNotification(title, {
    body: data.body || notification.body || '',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    tag: data.tag || 'lawexa-push',
    data: { url: data.url || '/' },
  });
});

// Tap the notification → focus an existing Lawexa tab (and navigate it) or open
// a new one at the deep link.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(url).catch(() => {});
            return undefined;
          }
        }
        return clients.openWindow ? clients.openWindow(url) : undefined;
      })
  );
});
