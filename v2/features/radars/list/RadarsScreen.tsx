'use client';

import { Suspense } from 'react';

import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { RadarsBrowser } from './RadarsBrowser';
import { RadarListSkeleton } from './states';

/**
 * RadarsScreen — the `/radars` client root. One job, ABOVE the
 * `useSearchParams` boundary (the `CasesScreen` shape): wrapping the
 * `useSearchParams` consumer (`RadarsBrowser` reads the status tab) in the
 * Suspense boundary Next requires, with a fallback that mirrors `loading.tsx`
 * exactly so route boundary → fallback → live list is one continuous shape.
 *
 * It no longer publishes a header title: `/radars` is a TOP-LEVEL screen, whose
 * bar carries none. See `CasesScreen` for the full note.
 */
export function RadarsScreen() {
  return (
    <Suspense fallback={<RadarsFallback />}>
      <RadarsBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the title, the tab strip and the create button as plain
 * reserved shapes (they wait on no request, so none of them pulses), over the
 * list skeleton, which pulses here exactly as it does in the live screen.
 * Identical to `app/v2/radars/loading.tsx`, which imports this component.
 *
 * "New radar" is reserved again: it is back in this row from the floating dock,
 * so its arrival would otherwise widen the row on the hand-off.
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
        <ScreenTitle />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="h-9 w-56 rounded-full bg-secondary/60" />
          <div className="h-9 w-28 rounded-full bg-secondary/60" />
        </div>
        <RadarListSkeleton />
      </div>
    </>
  );
}
