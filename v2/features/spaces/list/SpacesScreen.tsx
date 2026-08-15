'use client';

import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { SpacesBrowser } from './SpacesBrowser';
import { SpacesListSkeleton } from './states';

/**
 * SpacesScreen — the `/spaces` client root. One job, ABOVE the
 * `useSearchParams` boundary so it does not depend on the URL (the
 * `BookmarksScreen` / `CasesScreen` shape): wrapping the `useSearchParams`
 * consumer (`SpacesBrowser` reads the type tab) in the Suspense boundary Next
 * requires, with a fallback that mirrors `loading.tsx` exactly — so route
 * boundary → this fallback → live list is one continuous shape with nothing
 * moving at either hand-off.
 *
 * It no longer publishes a header title: `/spaces` is a TOP-LEVEL screen, whose
 * bar carries none. See `CasesScreen` for the full note.
 *
 * Phase-5 W4, 2026-08-04.
 */
export function SpacesScreen() {
  return (
    <Suspense fallback={<SpacesFallback />}>
      <SpacesBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the toolbar's reserved shape over the real list skeleton.
 * Identical to `app/v2/spaces/(list)/loading.tsx`, which imports this component
 * so the two can never drift.
 *
 * Every shape in it pulses, exactly as the live screen's own pending render
 * does. A wait is a wait: the reader cannot tell a route payload from a
 * request, so freezing half of one load and shimmering the other half would
 * only print a seam across the middle of it.
 *
 * `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is DELETED,
 * not reconciled, when content arrives — so anything focusable inside would
 * lose focus mid-interaction.
 */
export function SpacesFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your spaces
      </span>
      <div aria-hidden inert className={LIST_COLUMN_DOCKED}>
        <ScreenTitle />
        {/* Nothing is reserved on the right any more: "New space" has left the
            toolbar for the floating action, and the invitations pill is
            conditional chrome absent for nearly every reader, so holding a slot
            for it would be reserving a shape that usually never arrives. */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-44 rounded-full" />
        </div>
        <SpacesListSkeleton />
      </div>
    </>
  );
}
