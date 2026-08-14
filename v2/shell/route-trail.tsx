'use client';

import { useRouteTrail } from '@/v2/runtime/back-to';

/**
 * RouteTrail — mounts the visit trail that {@link useBackTo} falls back on.
 *
 * A component rather than a call inside the layout because the trail reads
 * `useSearchParams`, which puts its caller in a Suspense boundary; keeping that
 * requirement in one null-rendering leaf means the layout does not have to wear
 * it. Same shape as `ScrollMemory` beside it, and for the same reason.
 */
export function RouteTrail(): null {
  useRouteTrail();
  return null;
}
