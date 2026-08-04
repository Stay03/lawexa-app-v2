import { getIosBrowser, isIOS, isStandaloneDisplay, type IosBrowser } from '@/lib/utils/pwa';
import { isFirebaseConfigured } from './fcm';

/**
 * What THIS browser can do about closed-app push. Ported from v1's
 * `usePushNotifications` capability block (`lib/hooks/**` is boundary-blocked
 * for v2) and reduced to a pure function, because nothing here changes during
 * a session:
 *
 *  - `supported` — the browser has Notification + service workers + Push API,
 *    the deploy carries an FCM config, and we are not in the iOS-tab case;
 *  - `requiresInstall` — iOS in a BROWSER TAB. Safari grants web push only to
 *    an installed (home-screen) PWA, so the honest answer there is an install
 *    hint, never a permission prompt that would be refused by the platform;
 *  - `iosBrowser` — which iOS browser, because "Add to Home Screen" sits in a
 *    different place in each one.
 *
 * The snapshot is COMPUTED ONCE and cached: `useSyncExternalStore` loops on a
 * fresh object per read (the standing stable-reference rule), and the answer
 * cannot change without a reload anyway — installing the PWA opens a new
 * context.
 */

export interface PushCapability {
  /** The browser + deploy can actually do FCM web push here. */
  readonly supported: boolean;
  /** iOS in a browser tab — web push needs an installed PWA first. */
  readonly requiresInstall: boolean;
  readonly iosBrowser: IosBrowser;
}

/** The server answer: no browser, no capability. A module constant, so the
 *  SSR snapshot is referentially stable too. */
export const SERVER_PUSH_CAPABILITY: PushCapability = {
  supported: false,
  requiresInstall: false,
  iosBrowser: 'other',
};

let cached: PushCapability | null = null;

export function pushCapability(): PushCapability {
  if (cached) return cached;
  if (typeof window === 'undefined') return SERVER_PUSH_CAPABILITY;
  const requiresInstall = isIOS() && !isStandaloneDisplay();
  const supported =
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    isFirebaseConfigured() &&
    !requiresInstall;
  cached = { supported, requiresInstall, iosBrowser: getIosBrowser() };
  return cached;
}
