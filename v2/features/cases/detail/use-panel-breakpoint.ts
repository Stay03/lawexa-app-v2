'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the viewport can host the side chat as a DOCKED COLUMN (≥80rem —
 * the same xl boundary everywhere in the case chat). Below it the chat is a
 * bottom sheet; the choice picks which of the MUTUALLY EXCLUSIVE containers
 * mounts, so it must be a JS value, not a CSS breakpoint — CSS-hiding both
 * would leave two live conversation controllers on one conversation.
 *
 * `null` = server/first paint (unknown). The chat surface only mounts client-
 * side after the case query resolves, so callers just render nothing for that
 * beat. Same `useSyncExternalStore` shape as `usePointerCapability` — no
 * setState-in-effect, one shared MediaQueryList.
 */

const QUERY = '(min-width: 80rem)';

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

export function usePanelBreakpoint(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
