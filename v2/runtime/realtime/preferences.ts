import { useSyncExternalStore } from 'react';

/**
 * Notification delivery preferences — the independent sound / toast toggles
 * plus "pause notifications", persisted per device. Spec: plan W1 item 3 +
 * design-research.md DIRECTION 6; sound is OFF by default per owner decision
 * D8 (2026-08-04, legal-work context).
 *
 * WHAT THESE GATE — AND WHAT THEY NEVER GATE. The dispatcher consults this
 * store before any toast or sound. BADGES ARE EXEMPT by contract: counts,
 * bold rows, the title "(n)" and the favicon dot always reflect the truth
 * (digest §D — even a muted member's badge stays accurate), so `paused`
 * silences delivery without ever making the UI lie about what is unread.
 *
 * SHAPE: the `v2/stream-style.ts` pattern exactly — a module-level external
 * store read through `useSyncExternalStore`, localStorage-backed (a per-device
 * delivery preference; the server never needs it), one `storage` listener
 * reference-counted on the subscriber set for cross-tab sync, and a CACHED
 * snapshot object so the hook returns a referentially-stable value (the
 * `useSyncExternalStore` loop hazard). Deliberately NOT `'use client'`:
 * `window` is only touched inside callbacks, so the module is safe to
 * evaluate during SSR.
 *
 * CROSS-TAB WITHOUT A SUBSCRIBER: the `storage` listener exists only while a
 * React subscriber is mounted, but the DISPATCHER reads through
 * {@link readNotifyPreferences} in tabs that may never mount a settings
 * control — so that path re-reads storage itself whenever no subscriber is
 * holding the listener (audit W1-M1: a pause flipped in tab A must silence
 * tab B's toasts too). Value-compared, so the cached reference stays stable
 * when nothing changed.
 */

const STORAGE_KEY = 'lawexa-v2-notify-prefs';

export interface NotifyPreferences {
  /** Mention chime (≤300ms, coalesced). OFF by default — owner decision D8. */
  readonly sound: boolean;
  /** Mention toasts. On by default; badges are unaffected either way. */
  readonly toast: boolean;
  /** Pause ALL delivery (toast + sound). Badges keep updating — see above. */
  readonly paused: boolean;
}

const DEFAULTS: NotifyPreferences = { sound: false, toast: true, paused: false };

/** Cached snapshot so `getSnapshot` returns a referentially-stable object. */
let current: NotifyPreferences | null = null;
const listeners = new Set<() => void>();

function parseStored(raw: string | null): NotifyPreferences {
  if (!raw) return DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS;
    const record = parsed as Record<string, unknown>;
    return {
      sound: typeof record.sound === 'boolean' ? record.sound : DEFAULTS.sound,
      toast: typeof record.toast === 'boolean' ? record.toast : DEFAULTS.toast,
      paused: typeof record.paused === 'boolean' ? record.paused : DEFAULTS.paused,
    };
  } catch {
    // Corrupted value: the defaults are always safe.
    return DEFAULTS;
  }
}

function readFromStorage(): NotifyPreferences {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    return parseStored(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Private-mode / storage-disabled: fall back to the defaults.
    return DEFAULTS;
  }
}

function getSnapshot(): NotifyPreferences {
  current ??= readFromStorage();
  return current;
}

function getServerSnapshot(): NotifyPreferences {
  return DEFAULTS;
}

/** Cross-tab reconcile — `storage` fires only in OTHER tabs (stream-style rule). */
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

function write(next: NotifyPreferences): void {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Non-persistent is acceptable; the choice still applies in-memory.
  }
  for (const listener of listeners) listener();
}

function prefsEqual(a: NotifyPreferences, b: NotifyPreferences): boolean {
  return a.sound === b.sound && a.toast === b.toast && a.paused === b.paused;
}

/** Read once, outside React — the dispatcher's per-event read path. */
export function readNotifyPreferences(): NotifyPreferences {
  // No mounted subscriber ⇒ no `storage` listener keeping `current` honest
  // across tabs — re-read here so another tab's change reaches this
  // dispatcher (module docblock, audit W1-M1).
  if (listeners.size === 0) {
    const fresh = readFromStorage();
    if (current === null || !prefsEqual(current, fresh)) current = fresh;
  }
  return getSnapshot();
}

export function setNotifySound(sound: boolean): void {
  const prev = getSnapshot();
  if (prev.sound === sound) return;
  write({ ...prev, sound });
}

export function setNotifyToast(toast: boolean): void {
  const prev = getSnapshot();
  if (prev.toast === toast) return;
  write({ ...prev, toast });
}

export function setNotificationsPaused(paused: boolean): void {
  const prev = getSnapshot();
  if (prev.paused === paused) return;
  write({ ...prev, paused });
}

/** Subscribe a component (the future settings/bell controls) to the prefs. */
export function useNotifyPreferences(): NotifyPreferences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
