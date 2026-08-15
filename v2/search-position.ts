import { useSyncExternalStore } from 'react';

/**
 * WHERE A LIST'S SEARCH BOX SITS — a developer/tester preference.
 *
 *  - `bottom` (default) — a floating pill in the `ScreenDock`, within thumb
 *    reach, with the list scrolling behind it. The owner's decision, verbatim:
 *    "Let's leave it at the bottom gpt style but settable. But bottom as
 *    default."
 *  - `top` — the field back in the flow, under the screen's title and above the
 *    filter row, which is where every v2 list put it until now.
 *
 * SETTABLE MEANS A DEVELOPER SWITCH, NOT A USER SETTING. It lives beside the v2
 * preview toggle and the streamed-answer style in `/settings/developer`, and
 * nothing in the product surfaces it. Bottom is the default and stays the
 * default; the switch exists so the two can be compared on a real device
 * without a rebuild.
 *
 * SHAPE. Copied from `v2/stream-style.ts`, deliberately and exactly: a
 * module-level external store read through `useSyncExternalStore`, so the
 * settings control and every list screen read ONE value; `getServerSnapshot`
 * returns the default so SSR and the first client render agree (a mismatch here
 * would be a hydration error AND a visible jump of the search box from one end
 * of the screen to the other); a `storage` listener keeps other tabs in step;
 * and the hook returns a PRIMITIVE, so the snapshot is referentially stable by
 * construction and cannot trip the `useSyncExternalStore` loop.
 *
 * localStorage rather than a cookie, for the same reason as the stream style:
 * `v2/cookie.ts` is a cookie because the SERVER proxy reads it on every
 * request, and nothing on the server ever needs to know which end of the screen
 * a search box is drawn at.
 *
 * Deliberately NOT `'use client'`: it exports plain functions and a hook, and
 * touches `window`/`localStorage` only inside callbacks (never at module
 * scope), so it is safe to evaluate during SSR and is consumed only by client
 * components.
 */

export type SearchPosition = 'bottom' | 'top';

const STORAGE_KEY = 'lawexa-v2-search-position';
const DEFAULT_POSITION: SearchPosition = 'bottom';

/** Cached snapshot so `getSnapshot` returns a referentially-stable value. */
let currentPosition: SearchPosition | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): SearchPosition {
  if (typeof window === 'undefined') return DEFAULT_POSITION;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'top'
      ? 'top'
      : DEFAULT_POSITION;
  } catch {
    // Private-mode / storage-disabled: fall back to the default.
    return DEFAULT_POSITION;
  }
}

function getSnapshot(): SearchPosition {
  if (currentPosition === null) currentPosition = readFromStorage();
  return currentPosition;
}

function getServerSnapshot(): SearchPosition {
  return DEFAULT_POSITION;
}

/**
 * Cross-tab reconcile: `localStorage.setItem` fires `storage` only in OTHER
 * tabs, so this heals background tabs when the position is changed elsewhere.
 * The same-tab update path goes through `setSearchPosition` → the listener loop.
 */
function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  currentPosition = readFromStorage();
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  // ONE window listener for the whole store, reference-counted on the
  // subscriber set — several list screens can be mounted behind a route
  // transition at once, and a listener each would put duplicates on `window`.
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(onStoreChange);

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** Persist + broadcast a new position. Every mounted list moves at once. */
export function setSearchPosition(position: SearchPosition): void {
  if (getSnapshot() === position) return;
  currentPosition = position;
  try {
    window.localStorage.setItem(STORAGE_KEY, position);
  } catch {
    // Non-persistent is acceptable; the choice still applies in-memory.
  }
  for (const listener of listeners) listener();
}

/** Read the current position once, outside React (for a lazy `useState`
 *  initializer in the v1 settings card, where subscribing would be overkill). */
export function readSearchPosition(): SearchPosition {
  return getSnapshot();
}

/** Subscribe a component to the current search position. */
export function useSearchPosition(): SearchPosition {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
