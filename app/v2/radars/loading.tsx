import { RadarsFallback } from '@/v2/features/radars/list/RadarsScreen';

/**
 * Route-level loading boundary for `/radars` — the SAME component as the
 * page's own Suspense fallback, so route boundary → Suspense fallback → live
 * list is one continuous shape and nothing moves at either hand-off (the
 * cases-route convention).
 */
export default function RadarsLoading() {
  return <RadarsFallback />;
}
