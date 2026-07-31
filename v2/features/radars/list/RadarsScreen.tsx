'use client';

import { Suspense, useEffect } from 'react';

import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { RadarsBrowser } from './RadarsBrowser';
import { RadarListSkeleton } from './states';

/**
 * RadarsScreen — the `/radars` client root. Two jobs, both ABOVE the
 * `useSearchParams` boundary (the `CasesScreen` shape):
 *
 *  1. PUBLISHES the header centre-slot title ("Radar") on mount and clears it
 *     on unmount — an external-store write, so legal in an effect under the
 *     React Compiler lint.
 *  2. Wraps the `useSearchParams` consumer (`RadarsBrowser` reads the status
 *     tab) in the Suspense boundary Next requires, with a fallback that
 *     mirrors `loading.tsx` exactly so route boundary → fallback → live list
 *     is one continuous shape.
 */
export function RadarsScreen() {
  useEffect(() => {
    setHeaderContext({ title: 'Radar', confidential: false });
    return () => clearHeaderContext();
  }, []);

  return (
    <Suspense fallback={<RadarsFallback />}>
      <RadarsBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the tab strip and the create button as STILL RESERVED
 * SHAPES (they wait on no request), over the real list skeleton. Identical to
 * `app/v2/radars/loading.tsx`, which imports this component.
 */
export function RadarsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading radars
      </span>
      {/* `aria-hidden` + `inert` (standards §8ii): a Suspense fallback is
          DELETED when content arrives, so nothing in it may hold focus. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="h-9 w-56 rounded-full bg-secondary/60" />
          <div className="h-9 w-28 rounded-full bg-secondary/60" />
        </div>
        <RadarListSkeleton still />
      </div>
    </>
  );
}
