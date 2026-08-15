import { DiscoverFallback } from '@/v2/features/spaces/discover/DiscoverScreen';

/**
 * Route-level loading boundary for `/spaces/discover` — the SAME frame the
 * screen itself paints, so route boundary → live screen is one continuous
 * shape and nothing moves at the hand-off (the cases-route convention).
 *
 * Added in the mobile overhaul's phase 8. This route previously had no boundary
 * of its own and fell through to the v2 segment boundary, which is deliberately
 * EMPTY — correct for a boundary that cannot know its destination, wrong for a
 * destination whose shape is known exactly.
 */
export default function DiscoverLoading() {
  return <DiscoverFallback />;
}
