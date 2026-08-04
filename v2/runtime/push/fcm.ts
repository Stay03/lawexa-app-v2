import type { FirebaseApp } from 'firebase/app';
import type { Messaging } from 'firebase/messaging';

/**
 * FCM web-push client, v2-owned. A PORT of `lib/firebase/messaging.ts`, not an
 * import: `lib/firebase/**` is boundary-blocked for v2 (eslint
 * `import/no-restricted-paths`), and the phase-5 rule is port-don't-import for
 * every v1 runtime module. The logic is deliberately the same — one browser
 * has ONE FCM registration token, and both trees must resolve the same one for
 * the shared service worker and the shared server-side device row to stay
 * coherent.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO — `onMessage`. FCM foreground
 * messages are IGNORED ENTIRELY (digest §F.16): while a tab is visible, Reverb
 * is the delivery path and the dispatcher is the one decision-maker. Never
 * register a foreground handler here. `isPushArmed()` in `./state.ts` is the
 * other half of that rule — what the dispatcher does when the tab is NOT
 * visible.
 *
 * The firebase SDK is pulled in through dynamic `import()` so it is code-split
 * into its own chunk and fetched only when push logic actually runs — the v2
 * shell must not carry it just because the lifecycle component is mounted.
 * Every browser global and SDK access is guarded, so this module is safe to
 * import anywhere, including from a module evaluated during SSR.
 *
 * The service worker (`public/firebase-messaging-sw.js`) is SHARED with v1 and
 * auto-registered by `getToken()`. W5 changes nothing in it — see
 * `w5-device-verification.md` for why the visible-tab dedup needs no SW edit.
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** True only when this deploy carries a usable FCM config AND a VAPID key. */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      VAPID_KEY,
  );
}

async function getFirebaseApp(): Promise<FirebaseApp> {
  const { getApp, getApps, initializeApp } = await import('firebase/app');
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * A Messaging instance only where FCM web push genuinely works (secure
 * context + service workers + Push API). Returns null on the server, when the
 * deploy is unconfigured, and on unsupported browsers (older Safari,
 * iOS-in-a-tab) so every caller no-ops cleanly instead of branching.
 */
async function getMessagingIfSupported(): Promise<Messaging | null> {
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
 * This device's FCM registration token. `getToken()` auto-registers the root
 * `/firebase-messaging-sw.js`. Returns null when unsupported or on ANY failure
 * (permission denied, no service worker, transient FCM error) — a missing
 * token is a state, never an exception to handle at every call site.
 */
export async function getFcmToken(): Promise<string | null> {
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

/**
 * Delete this device's FCM token (sign-out / disable). Best-effort: after this
 * resolves the browser stops receiving pushes for the old registration even if
 * the server-side row outlives it, which is what makes the sign-out edge safe
 * on a shared device (see `./lifecycle.tsx`).
 */
export async function deleteFcmToken(): Promise<void> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return;
  try {
    const { deleteToken } = await import('firebase/messaging');
    await deleteToken(messaging);
  } catch {
    // Best-effort — the server row is deactivated separately where possible.
  }
}
