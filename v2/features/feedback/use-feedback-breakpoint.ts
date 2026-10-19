'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether "Give feedback" opens as a CENTRED DIALOG (≥40rem, the `sm`
 * boundary) or, below it, a bottom sheet. A JS value, not a CSS breakpoint:
 * the two are separate dialogs, and CSS-hiding one would leave two focus traps
 * on one form (the reason `usePickerBreakpoint` exists for the folder picker).
 * Exactly one is ever in the tree.
 *
 * `null` = server render / no `matchMedia`. The form mounts only after a
 * press, long after hydration, so the caller renders nothing for that beat.
 */

const QUERY = '(min-width: 40rem)';

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

export function useFeedbackBreakpoint(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => getMediaQuery()?.matches ?? null,
    () => null,
  );
}
