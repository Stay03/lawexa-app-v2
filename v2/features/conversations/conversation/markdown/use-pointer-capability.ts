'use client';

import { useSyncExternalStore } from 'react';

/**
 * The device's primary pointer capability, resolved SSR-safely.
 *
 *  - `null`    the server + first hydration render (unknown) — callers render a
 *              neutral, navigable fallback so server and client agree.
 *  - `'fine'`  a hover-capable fine pointer (mouse / trackpad) → desktop hover-card.
 *  - `'coarse'` a touch pointer → the tap-to-preview popover.
 *
 * Implemented as a module-level external store read through `useSyncExternalStore`
 * (not `useState`+`useEffect`), so there is no setState-in-effect for the React
 * Compiler lint to reject and every case-mention on the page shares ONE media
 * query. `getServerSnapshot` returns `null`, so the first client render matches
 * SSR; after commit the real value resolves and the anchor upgrades to its
 * interactive variant with no hydration mismatch (the same sequencing `useMounted`
 * uses). The query mirrors the shell's hover-guard convention
 * (`(hover: hover) and (pointer: fine)`), so touch devices never get a hover-card.
 */

export type PointerCapability = 'fine' | 'coarse';

const QUERY = '(hover: hover) and (pointer: fine)';

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

function getSnapshot(): PointerCapability | null {
  return getMediaQuery()?.matches ? 'fine' : 'coarse';
}

function getServerSnapshot(): PointerCapability | null {
  return null;
}

export function usePointerCapability(): PointerCapability | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
