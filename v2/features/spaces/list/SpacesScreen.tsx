'use client';

import { Suspense, useEffect } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { SpacesBrowser } from './SpacesBrowser';
import { SpacesListSkeleton } from './states';

/**
 * SpacesScreen — the `/spaces` client root. Two jobs, both ABOVE the
 * `useSearchParams` boundary so neither depends on the URL (the
 * `BookmarksScreen` / `CasesScreen` shape):
 *
 *  1. PUBLISHES the shell header's centre-slot title ("Spaces") on mount and
 *     clears it on unmount — an external-store write, not React state, which
 *     is why it is legal inside an effect under the React Compiler lint.
 *  2. Wraps the `useSearchParams` consumer (`SpacesBrowser` reads the type
 *     tab) in the Suspense boundary Next requires, with a fallback that
 *     mirrors `loading.tsx` exactly — so route boundary → this fallback →
 *     live list is one continuous shape with nothing moving at either
 *     hand-off.
 *
 * Phase-5 W4, 2026-08-04.
 */
export function SpacesScreen() {
  useEffect(() => {
    setHeaderContext({ title: 'Spaces', confidential: false });
    return () => clearHeaderContext();
  }, []);

  return (
    <Suspense fallback={<SpacesFallback />}>
      <SpacesBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the toolbar as a STILL RESERVED SHAPE (it waits on no
 * request, so it never pulses) over the real list skeleton. Identical to
 * `app/v2/spaces/(list)/loading.tsx`, which imports this component so the two
 * can never drift.
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
      <div aria-hidden inert className={LIST_COLUMN}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-44 animate-none rounded-full" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-28 animate-none rounded-md" />
            <Skeleton className="h-8 w-28 animate-none rounded-md" />
          </div>
        </div>
        <SpacesListSkeleton still />
      </div>
    </>
  );
}
