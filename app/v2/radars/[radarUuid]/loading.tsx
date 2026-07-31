import { RadarDetailFallback } from '@/v2/features/radars/detail/RadarScreen';

/**
 * Route-level loading boundary for `/radars/[radarUuid]` — the SAME component
 * as the screen's Suspense fallback, so the hand-off moves nothing.
 */
export default function RadarLoading() {
  return <RadarDetailFallback />;
}
