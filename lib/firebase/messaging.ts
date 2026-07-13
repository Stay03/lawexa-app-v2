// Firebase Cloud Messaging (web) — closed-app push. The firebase SDK is pulled in
// via dynamic import() so it is code-split into its own chunk and only fetched
// when push logic actually runs (not shipped in the main bundle just because a
// widely-used hook like useAuth references deletePushToken). Every browser-global
// and SDK access is guarded, so this module is safe to import anywhere. Foreground
// messages are intentionally NOT wired here — the open-app case is already covered
// by Reverb (RealtimeNotifications).

import type { FirebaseApp } from 'firebase/app';
import type { Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** True only when the deploy actually carries a usable FCM config + VAPID key. */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      VAPID_KEY
  );
}

async function getFirebaseApp(): Promise<FirebaseApp> {
  const { getApp, getApps, initializeApp } = await import('firebase/app');
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * A Messaging instance only where FCM web push is genuinely supported (secure
 * context + service workers + Push API). Returns null on SSR, when unconfigured,
 * and on unsupported browsers (older Safari, iOS-in-tab) so callers no-op cleanly.
 */
export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) return null;
  try {
    const { getMessaging, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return null;
    return getMessaging(await getFirebaseApp());
  } catch {
    return null;
  }
}

/**
 * The FCM registration token for this device. `getToken` auto-registers the root
 * `/firebase-messaging-sw.js`. Returns null if unsupported or on any failure
 * (permission denied, no service worker, transient FCM error).
 */
export async function getPushToken(): Promise<string | null> {
  const messaging = await getMessagingIfSupported();
  if (!messaging || !VAPID_KEY) return null;
  try {
    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token || null;
  } catch {
    return null;
  }
}

/** Deletes this device's FCM token (logout / disable). Best-effort. */
export async function deletePushToken(): Promise<void> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return;
  try {
    const { deleteToken } = await import('firebase/messaging');
    await deleteToken(messaging);
  } catch {
    // best-effort — the row is also deactivated server-side via the REST call
  }
}
