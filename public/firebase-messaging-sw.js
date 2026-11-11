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

// Is the page this push opens already on screen in a Lawexa window? Compared by
// path, so `/c/{uuid}` matches the chat with any `?m=` or `?game=` on it.
function shownOnScreen(url) {
  let path;
  try {
    path = new URL(url, self.location.origin).pathname;
  } catch {
    return Promise.resolve(false);
  }
  return clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((list) =>
      list.some((client) => {
        try {
          return client.visibilityState === 'visible' && new URL(client.url).pathname === path;
        } catch {
          return false;
        }
      }),
    )
    .catch(() => false);
}

// Fires only when the app is closed / not focused. The backend sends the copy in
// the `data` payload (with a `url` deep link); fall back to `notification` fields.
//
// A push about a page the person is already looking at is dropped (Lawexa back
// in a chat that is open on screen in a window without focus; background jobs,
// Backend's shapes 063d9cc3, section 6): the page itself shows it. A chat open
// only in a hidden tab still gets its push.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = data.title || notification.title || 'Lawexa';
  const url = data.url || '/';
  return shownOnScreen(url).then((shown) => {
    if (shown && url !== '/') return undefined;
    return self.registration.showNotification(title, {
      body: data.body || notification.body || '',
      icon: '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png',
      tag: data.tag || 'lawexa-push',
      data: { url },
    });
  });
});

// Tap the notification → focus an existing Lawexa tab and move it to the deep
// link, or open a new one there.
//
// This worker controls no Lawexa page (Firebase registers it under its own
// scope), so the browser refuses `client.navigate` on every open tab. When it
// does, the link is posted to the tab and v2 routes there itself
// (v2/runtime/push/tap.ts; keep the type string in step). A v1 page does not
// listen, so it only comes to the front, as before.
const OPEN_URL_MESSAGE = 'lawexa:open-url';

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            const post = () => client.postMessage({ type: OPEN_URL_MESSAGE, url });
            const moved = 'navigate' in client ? client.navigate(url).catch(post) : Promise.resolve(post());
            return Promise.all([client.focus().catch(() => undefined), moved]);
          }
        }
        return clients.openWindow ? clients.openWindow(url) : undefined;
      })
  );
});
