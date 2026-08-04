import { useSyncExternalStore } from 'react';

/**
 * Push device state — what THIS browser has agreed to and what token it last
 * registered. Per-device by nature (a push subscription belongs to a browser
 * profile, not to an account), so it is localStorage, never the server.
 *
 * SHAPE: the `v2/runtime/realtime/preferences.ts` pattern exactly — a
 * module-level external store read through `useSyncExternalStore`, one
 * `storage` listener reference-counted on the subscriber set for cross-tab
 * sync, and a CACHED snapshot object so the hook returns a referentially
 * stable value (the `useSyncExternalStore` loop hazard). Deliberately NOT
 * `'use client'`: `window` is touched only inside functions, so the module is
 * safe to evaluate during SSR.
 *
 * WHY IT IS SEPARATE FROM `preferences.ts`. Those are DELIVERY preferences for
 * the open app (toast / sound / pause) and the user changes them freely. This
 * is a device REGISTRATION record — a mirror of server state, written by the
 * registration code and read by the dispatcher's dedup check. Two different
 * lifetimes, two different owners; merging them would let a preference toggle
 * silently invalidate a server-side row.
 *
 * IT DOES NOT SHARE v1's STORE. v1 keeps the same three facts in
 * `lib/stores/notificationPrefsStore` (zustand-persist), which v2 may not
 * import — and must not write behind its back either. Both trees resolve the
 * SAME FCM token from the same service worker, and `POST
 * /notification-channels/push` is an idempotent upsert by token, so two
 * records of one truth converge instead of fighting. The one consequence is
 * documented at the sign-out edge in `./lifecycle.tsx`.
 */

const STORAGE_KEY = 'lawexa-v2-push';

export interface PushDeviceState {
  /** The FCM token this browser last registered server-side; null = none. */
  readonly token: string | null;
  /**
   * The AUTO-REGISTER POLICY for this device — deliberately three-valued:
   *  - `null`  = undecided here. The boot re-sync may register if the OS
   *    permission is already granted. This is the state of every device that
   *    granted permission on a v1 page (v1's own store is invisible to v2), and
   *    treating it as "no" is what would leave such a device un-armed in v2 and
   *    therefore notified TWICE — once by the OS, once by the in-app alert.
   *  - `true`  = the viewer went through the nudge here.
   *  - `false` = the viewer turned push OFF here. The boot re-sync must never
   *    undo that, which is the whole reason this is not a plain boolean.
   */
  readonly enabled: boolean | null;
  /** The in-channel nudge was dismissed on this device. */
  readonly nudgeDismissed: boolean;
}

const DEFAULTS: PushDeviceState = {
  token: null,
  enabled: null,
  nudgeDismissed: false,
};

/** Cached snapshot so `getSnapshot` returns a referentially-stable object. */
let current: PushDeviceState | null = null;
const listeners = new Set<() => void>();

function parseStored(raw: string | null): PushDeviceState {
  if (!raw) return DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS;
    const record = parsed as Record<string, unknown>;
    return {
      token: typeof record.token === 'string' ? record.token : DEFAULTS.token,
      // Anything that is not an explicit boolean means "undecided".
      enabled: typeof record.enabled === 'boolean' ? record.enabled : null,
      nudgeDismissed:
        typeof record.nudgeDismissed === 'boolean'
          ? record.nudgeDismissed
          : DEFAULTS.nudgeDismissed,
    };
  } catch {
    // Corrupted value: the defaults are always safe (they enable nothing).
    return DEFAULTS;
  }
}

function readFromStorage(): PushDeviceState {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    return parseStored(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULTS;
  }
}

function statesEqual(a: PushDeviceState, b: PushDeviceState): boolean {
  return (
    a.token === b.token &&
    a.enabled === b.enabled &&
    a.nudgeDismissed === b.nudgeDismissed
  );
}

function getSnapshot(): PushDeviceState {
  current ??= readFromStorage();
  return current;
}

function getServerSnapshot(): PushDeviceState {
  return DEFAULTS;
}

/** Cross-tab reconcile — `storage` fires only in OTHER tabs. */
function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  current = readFromStorage();
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/**
 * Read outside React — the registration code's and the dispatcher's path.
 *
 * Re-reads storage when NO React subscriber holds the `storage` listener, for
 * the same reason `readNotifyPreferences` does (audit W1-M1): a tab that never
 * mounts a push control still has to see a registration made in another tab,
 * or it would dedup against a subscription this device no longer has.
 */
export function readPushDeviceState(): PushDeviceState {
  if (listeners.size === 0) {
    const fresh = readFromStorage();
    if (current === null || !statesEqual(current, fresh)) current = fresh;
  }
  return getSnapshot();
}

function write(next: PushDeviceState): void {
  const previous = getSnapshot();
  if (statesEqual(previous, next)) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Non-persistent is acceptable; the state still applies in-memory.
  }
  for (const listener of listeners) listener();
}

/** Record the token this device just registered (or `null` after teardown). */
export function setPushToken(token: string | null): void {
  write({ ...getSnapshot(), token });
}

/** Record an EXPLICIT choice about push on this device (see the field doc). */
export function setPushEnabled(enabled: boolean): void {
  write({ ...getSnapshot(), enabled });
}

/** Dismiss the in-channel nudge on this device (never re-armed automatically). */
export function dismissPushNudge(): void {
  write({ ...getSnapshot(), nudgeDismissed: true });
}

/** The browser's current permission, guarded for SSR and old browsers. */
export function notificationPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return null;
  }
  return Notification.permission;
}

/**
 * IS A CLOSED-APP PUSH GOING TO COVER THIS EVENT? — the dispatcher's dedup
 * input (plan W5 item 1; the seam `dispatcher.ts` documented in W1).
 *
 * True only when BOTH hold: we hold a token we actually registered, and the OS
 * permission is still granted. Either one missing and the server has no way to
 * reach this browser, so the in-app alert is the ONLY delivery there is and
 * must not be suppressed. (`enabled` is not consulted: turning push off clears
 * the token, so a token's existence already implies it.)
 *
 * Deliberately synchronous and cheap — it runs inside the per-event decision.
 */
export function isPushArmed(): boolean {
  return (
    readPushDeviceState().token !== null &&
    notificationPermission() === 'granted'
  );
}

/** Subscribe a component (the nudge) to this device's push state. */
export function usePushDeviceState(): PushDeviceState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
