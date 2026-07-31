import { StatutesFallback } from '@/v2/features/statutes/list/StatutesScreen';

/**
 * Route-level loading boundary for `/statutes` — the SAME component as the
 * page's own Suspense fallback, so route boundary → Suspense fallback → live
 * list is one continuous shape and nothing moves at either hand-off (the
 * cases-library convention). Static chrome (search field, tab row) is a STILL
 * RESERVED SHAPE, never a pulsing skeleton; only the rows hold their shape.
 */
export default function StatutesLoading() {
  return <StatutesFallback />;
}
