'use client';

import { Suspense } from 'react';

import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { BookmarksBrowser } from './BookmarksBrowser';
import { BookmarksListSkeleton } from './states';

/**
 * BookmarksScreen — the `/bookmarks` client root. One job, ABOVE the
 * `useSearchParams` boundary so it does not depend on the URL (the
 * `CasesScreen` / `RadarsScreen` shape): wrapping the `useSearchParams`
 * consumer (`BookmarksBrowser` reads the type tab) in the Suspense boundary
 * Next requires, with a fallback that mirrors `loading.tsx` exactly — so route
 * boundary → this fallback → live list is one continuous shape with nothing
 * moving at either hand-off.
 *
 * It no longer publishes a header title: `/bookmarks` is a TOP-LEVEL screen,
 * whose bar carries none. See `CasesScreen` for the full note.
 *
 * NO DOCK ON THIS SCREEN. It has no search box and — the owner's own list — no
 * one obvious main action, so there is nothing to float and the plain
 * `LIST_COLUMN` is still right here.
 */
export function BookmarksScreen() {
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
        <ScreenTitle />
        <div className="mb-3 flex items-center">
          <div className="h-9 w-72 max-w-full rounded-full bg-secondary/60" />
        </div>
        <BookmarksListSkeleton />
      </div>
    </>
  );
}
