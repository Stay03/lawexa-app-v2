import { StatsFallback } from '@/v2/features/activity-stats/StatsFallback';

/**
 * Route-level loading boundary for `/activity/stats`: the screen's own loading
 * shape, not the questions table's above it.
 */
export default function ActivityStatsLoading() {
  return <StatsFallback />;
}
