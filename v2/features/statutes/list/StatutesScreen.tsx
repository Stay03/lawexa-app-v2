'use client';

import { Suspense } from 'react';

import { StatutesBrowser } from './StatutesBrowser';
import { StatutesFallback } from './StatutesFallback';

/**
 * StatutesScreen — the `/statutes` client root. The exact job of `CasesScreen`,
 * ABOVE the `useSearchParams` boundary: wrapping the `useSearchParams` consumer
 * in a Suspense boundary (a Next requirement), with a fallback that mirrors
 * `loading.tsx` exactly so route boundary → this fallback → live content is one
 * continuous shape.
 *
 * It no longer publishes a header title. `/statutes` is a TOP-LEVEL screen and
 * the bar on one of those carries none — the title is in the page body
 * (`ScreenTitle`, from `top-level-route.ts`). See `CasesScreen` for the full
 * note; the removal is the same on all nine library screens.
 *
 * WHO CAN READ THIS: the route ships real metadata (a public, indexed
 * surface), but the DATA is auth-walled — measured July 31, 2026, every
 * statute endpoint 401s without a bearer token. `StatutesBrowser` gates its
 * queries on the session and shows the designed sign-in state; a signed-in
 * GUEST holds a real token and browses normally.
 */
export function StatutesScreen() {
  return (
    <Suspense fallback={<StatutesFallback />}>
      <StatutesBrowser />
    </Suspense>
  );
}
