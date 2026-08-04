'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

/**
 * useOverflowEdges — which edges of a horizontal scroller still hide content.
 *
 * Exists because a scrollable toolbar that cuts on a CLEAN edge reads as
 * complete: the notes formatting bar hid five verbs past the right edge of a
 * 390px phone and looked finished doing it. The fix is an affordance that
 * TELLS THE TRUTH, so the answer is computed from live geometry — scroll
 * position, element resizes, content growth — via `useSyncExternalStore`
 * (the house pattern for browser-owned state; an effect writing React state
 * from a ResizeObserver is both a Compiler-lint violation and a paint-order
 * bet). The snapshot is a primitive bitmask, so consumers re-render only
 * when an edge actually appears or disappears.
 */
export const OVERFLOW_LEFT = 1;
export const OVERFLOW_RIGHT = 2;

export function useOverflowEdges(): {
  /** Callback ref — hand it the scroller. */
  attach: (el: HTMLElement | null) => void;
  /** Bitmask of `OVERFLOW_LEFT` / `OVERFLOW_RIGHT`; `0` when nothing is hidden. */
  edges: number;
} {
  const [el, setEl] = useState<HTMLElement | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!el) return () => {};
      el.addEventListener('scroll', onChange, { passive: true });
      window.addEventListener('resize', onChange);
      const observer = new ResizeObserver(onChange);
      observer.observe(el);
      return () => {
        el.removeEventListener('scroll', onChange);
        window.removeEventListener('resize', onChange);
        observer.disconnect();
      };
    },
    [el],
  );

  const getSnapshot = useCallback(() => {
    if (!el) return 0;
    // ±1px slack: engines report fractional scroll positions.
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 1) return 0;
    let edges = 0;
    if (el.scrollLeft > 1) edges |= OVERFLOW_LEFT;
    if (el.scrollLeft < maxScroll - 1) edges |= OVERFLOW_RIGHT;
    return edges;
  }, [el]);

  const edges = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  return { attach: setEl, edges };
}
