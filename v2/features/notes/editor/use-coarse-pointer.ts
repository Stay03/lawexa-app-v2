'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether this device's primary pointer is a FINGER — the question that decides
 * whether the editor gets a selection bubble or a docked formatting bar.
 *
 * ── WHY IT IS A REAL QUESTION AND NOT A BREAKPOINT ──────────────────────────
 * A selection bubble is unusable on iOS: selecting text raises the system
 * callout (Copy / Look Up / Share) over exactly the spot a bubble would occupy,
 * and it cannot be suppressed from a web page (Tiptap #1806, #6276). So touch
 * devices get their formatting in the shell's dock row, riding above the
 * keyboard, and never see a bubble. That is a capability decision, not a width
 * one — a 1400px touch laptop must get the dock bar and a 600px window on a
 * desktop must keep the bubble.
 *
 * ── THE SHAPE ───────────────────────────────────────────────────────────────
 * `null` on the server and the first hydration render (unknown), then the real
 * answer after commit — the same `useSyncExternalStore` idiom as
 * `usePanelBreakpoint` and `usePointerCapability`, with no setState-in-effect
 * for the React Compiler lint to reject and one shared `MediaQueryList` for the
 * whole editor. Callers render NEITHER toolbar while it is `null`: both are
 * chrome, and a one-frame absence is invisible next to guessing wrong.
 *
 * DELIBERATELY LOCAL, not an import of the conversations feature's
 * `usePointerCapability`. That hook is a markdown-rendering internal answering
 * "does this device hover?"; this one answers "can this device host a selection
 * bubble?". Same media query today, different questions — and the notes editor
 * must not take a dependency on another feature's private module to say so.
 */

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

function getSnapshot(): boolean | null {
  const query = getMediaQuery();
  return query === null ? null : !query.matches;
}

function getServerSnapshot(): boolean | null {
  return null;
}

/** `true` = touch (dock bar), `false` = pointer (bubble menu), `null` = not yet known. */
export function useCoarsePointer(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
