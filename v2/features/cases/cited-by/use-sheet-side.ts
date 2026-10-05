'use client';

import { useSyncExternalStore } from 'react';

/**
 * Which edge the "See all" panel slides from: the RIGHT where the case page has
 * room beside the reading column (≥48rem, the shell's `md`), the BOTTOM on a
 * phone, where a thumb reaches and the sheet can take nearly the full height.
 *
 * A JS value rather than two CSS-hidden sheets, because only one dialog may
 * hold focus. Same `useSyncExternalStore` shape as `usePanelBreakpoint`: one
 * shared MediaQueryList, no setState in an effect. The server answer is
 * `right`, and it is never painted: the sheet's content mounts only when the
 * reader opens it, which is always on the client.
 */

const QUERY = '(min-width: 48rem)';

export type SheetSide = 'right' | 'bottom';

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

function getSnapshot(): SheetSide {
  return getMediaQuery()?.matches === false ? 'bottom' : 'right';
}

function getServerSnapshot(): SheetSide {
  return 'right';
}

export function useSheetSide(): SheetSide {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
