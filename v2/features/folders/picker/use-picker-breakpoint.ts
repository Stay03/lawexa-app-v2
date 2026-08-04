'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the viewport can host the folder picker as a CENTRED DIALOG (≥40rem,
 * the `sm` boundary). Below it the picker is a bottom sheet.
 *
 * This picks which of two MUTUALLY EXCLUSIVE containers mounts, so it must be a
 * JS value and not a CSS breakpoint: CSS-hiding one of two mounted dialogs
 * would leave two focus traps, two listboxes and two live regions fighting over
 * one interaction — the same reason `usePanelBreakpoint` exists for the case
 * chat. Exactly one surface is ever in the tree.
 *
 * `null` = server render / no `matchMedia` (unknown). The picker only mounts
 * after a press, long after hydration, so callers simply render nothing for
 * that beat rather than guessing a width.
 *
 * `useSyncExternalStore` with one shared `MediaQueryList` — no setState in an
 * effect (React Compiler lint runs as errors here).
 */

const QUERY = '(min-width: 40rem)';

let cachedQuery: MediaQueryList | null = null;

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
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

export function usePickerBreakpoint(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
