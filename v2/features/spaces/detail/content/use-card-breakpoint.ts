'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether a space file's card opens as the small card under its row (≥48rem,
 * the `md` boundary) or as the phone's bottom sheet (Stay, 18 October 2026,
 * 19:46 UTC: option 1 on a computer; the phone keeps the sheet).
 *
 * A JS value, not a CSS breakpoint: the two are different containers (a
 * popover and a dialog), and exactly one may be in the tree, with one focus
 * scope. `null` on the server and before `matchMedia` answers; the card only
 * opens after a tap, long after that, so callers treat `null` as the sheet.
 *
 * `useSyncExternalStore` with one shared `MediaQueryList`, as
 * `usePickerBreakpoint` does: no setState in an effect.
 */

const QUERY = '(min-width: 48rem)';

let cachedQuery: MediaQueryList | null = null;

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  if (!cachedQuery) cachedQuery = window.matchMedia(QUERY);
  return cachedQuery;
}

function subscribe(onChange: () => void): () => void {
  const query = getMediaQuery();
  if (!query) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean | null {
  return getMediaQuery()?.matches ?? null;
}

function getServerSnapshot(): boolean | null {
  return null;
}

export function useCardBreakpoint(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
