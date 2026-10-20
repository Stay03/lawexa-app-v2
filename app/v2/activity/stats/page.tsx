import type { Metadata } from 'next';
import { StatsScreen } from '@/v2/features/activity-stats/StatsScreen';

/**
 * v2 `/activity/stats`: the reader's own totals, streaks and active days.
 * `v2/routes.manifest.ts` claims this EXACT path. Private: never indexed.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Your stats',
    description: 'Your activity in Lawexa: totals, streaks and active days.',
    robots: { index: false, follow: false },
  };
}

/** Every read is a client query the screen owns; the segment awaits nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2ActivityStatsPage() {
  return <StatsScreen />;
}
