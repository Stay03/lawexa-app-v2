'use client';

import { useEffect, useRef } from 'react';

/**
 * useInfiniteScrollSentinel — wires a TanStack `useInfiniteQuery` to a sentinel
 * row so a new page loads as the sentinel scrolls into view (owner #26). Returns
 * a ref to place on the sentinel element; give it the surface's OWN scroll region
 * as `rootRef` so the prefetch margin is measured against that container, not the
 * viewport (the sidebar rail + drawer both scroll internally, not the document).
 *
 * LINT-SAFE (React Compiler): the observer lives in an effect and only ever calls
 * `fetchNextPage()` from its callback — there is NO `setState` in the effect, so
 * the `set-state-in-effect` rule is satisfied. `fetchNextPage` is referentially
 * stable (TanStack memoizes it), and `rootRef`/`rootMargin` are stable, so the
 * effect's real dependencies are `hasNextPage` + `isFetchingNextPage`: when a
 * fetch settles the observer is rebuilt and re-`observe()`d, which re-fires the
 * callback if the sentinel is still visible — so a short list keeps loading until
 * the sentinel is finally pushed out of view or `hasNextPage` is false.
 *
 * `Root` is generic so each call site can pass its own concretely-typed scroll
 * ref (`HTMLDivElement`, …) without a `RefObject` invariance clash.
 */
export function useInfiniteScrollSentinel<
  Sentinel extends HTMLElement,
  Root extends HTMLElement = HTMLElement,
>({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  rootRef,
  rootMargin = '240px',
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** The scroll container to measure against (defaults to the viewport). */
  rootRef?: React.RefObject<Root | null>;
  rootMargin?: string;
}): React.RefObject<Sentinel | null> {
  const sentinelRef = useRef<Sentinel | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: rootRef?.current ?? null, rootMargin, threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rootRef, rootMargin]);

  return sentinelRef;
}
