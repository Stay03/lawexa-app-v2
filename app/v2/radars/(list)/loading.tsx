import { RadarsFallback } from '@/v2/features/radars/list/RadarsScreen';

/**
 * Route-level loading boundary for `/radars` — the SAME component as the
 * page's own Suspense fallback, so route boundary → Suspense fallback → live
 * list is one continuous shape and nothing moves at either hand-off (the
 * cases-route convention).
 *
 * IT LIVES IN A ROUTE GROUP SO IT WRAPS THE LIST AND NOTHING ELSE. Before the
 * group existed this file sat at `radars/loading.tsx`, where it also wrapped
 * `[radarUuid]`, its scans and `new/` — painting the list on the way to a
 * document. Do not move it back up; `radars/loading.tsx` explains what the
 * segment level is for.
 */
export default function RadarsLoading() {
  return <RadarsFallback />;
}
