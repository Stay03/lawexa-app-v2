'use client';

import { Suspense, useEffect } from 'react';

import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { BookmarksBrowser } from './BookmarksBrowser';
import { BookmarksListSkeleton } from './states';

/**
 * BookmarksScreen — the `/bookmarks` client root. Two jobs, both ABOVE the
 * `useSearchParams` boundary so neither depends on the URL (the `CasesScreen` /
 * `RadarsScreen` shape):
 *
 *  1. PUBLISHES the header centre-slot title ("Bookmarks") on mount and clears
 *     it on unmount — an external-store write, not React state, which is why it
 *     is legal inside an effect under the React Compiler lint.
 *  2. Wraps the `useSearchParams` consumer (`BookmarksBrowser` reads the type
 *     tab) in the Suspense boundary Next requires, with a fallback that mirrors
 *     `loading.tsx` exactly — so route boundary → this fallback → live list is
 *     one continuous shape with nothing moving at either hand-off.
 */
export function BookmarksScreen() {
  useEffect(() => {
    setHeaderContext({ title: 'Bookmarks', confidential: false });
    return () => clearHeaderContext();
  }, []);

  return (
    <Suspense fallback={<BookmarksFallback />}>
      <BookmarksBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the tab strip as a reserved chrome shape (furniture, not
 * a content placeholder) over the real list skeleton. Identical to
 * `app/v2/bookmarks/loading.tsx`, which imports this component so the two can
 * never drift.
 *
 * The list skeleton pulses here exactly as it does inside the live screen
 * (standards §8i). A wait is a wait: the reader cannot tell an RSC payload from
 * a query, so two appearances for one wait would only print a seam into the
 * middle of the load.
 */
export function BookmarksFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your bookmarks
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED, not reconciled, when content arrives — so anything focusable
          in here would lose focus and caret mid-interaction. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <div className="mb-3 flex items-center">
          <div className="h-9 w-72 max-w-full rounded-full bg-secondary/60" />
        </div>
        <BookmarksListSkeleton />
      </div>
    </>
  );
}
