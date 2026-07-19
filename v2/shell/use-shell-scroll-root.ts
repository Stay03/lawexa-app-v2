'use client';

import { useEffect, useRef } from 'react';
import { V2_SHELL_CONTENT_ID } from './shell-content';

/**
 * useShellScrollRoot — a ref to the AppShell content region (the shell's single
 * scroll container), for IntersectionObserver roots.
 *
 * WHY (W5 review finding): a full-page surface's sentinel lives INSIDE
 * `.v2-shell__content` (`overflow-y: auto`). With a viewport root (`root: null`)
 * the observer's `rootMargin` expands only the viewport box, while the nested
 * scroll container still clips the target with its PLAIN rect — so the prefetch
 * margin is silently lost and the next page loads only at the exact bottom.
 * Rooting against the real scroller restores the early-load band. (The sidebar
 * rail and drawer already do this with their own scroll regions' refs; this hook
 * is the same seam for surfaces that scroll in the shell's content region.)
 *
 * Populated in an effect (no state, lint-clean). Call this hook BEFORE any hook
 * whose effect reads the ref — component-body declaration order runs this
 * populate effect first on mount.
 */
export function useShellScrollRoot(): React.RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    ref.current = document.getElementById(V2_SHELL_CONTENT_ID);
    return () => {
      ref.current = null;
    };
  }, []);
  return ref;
}
