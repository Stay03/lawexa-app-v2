import { StatsFallback } from '@/v2/features/quiz/stats/states';

/**
 * Route-level loading boundary for `/quiz/stats`.
 *
 * It renders the SAME heading the screen does — for real, not as grey bars,
 * because a page title waits on no request (standards §8i) — over the STILL
 * skeleton for the tiles, the chart and the summary blocks, which do.
 */
export default function QuizStatsLoading() {
  return <StatsFallback />;
}
