import { ActivityFallback } from '@/v2/features/activity/states';

/**
 * Route-level loading boundary for `/activity`: the same silhouette the
 * screen's Suspense fallback and first load draw, so the hand-off moves
 * nothing.
 */
export default function ActivityLoading() {
  return <ActivityFallback />;
}
