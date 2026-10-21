import type { Metadata } from 'next';
import { StatsScreen } from '@/v2/features/quiz/stats/StatsScreen';

/**
 * v2 `/quiz/stats` — server shell for the student's own progress.
 *
 * PRIVATE, and the ONLY place these numbers live: there is no home strip and no
 * progress module anywhere else (the owner removed the home quiz module in
 * July). So it takes the `/conversations` treatment — a bare title, a
 * description, `robots: noindex`, no canonical, no OG card.
 *
 * NO SERVER PREFETCH (the `/radars` precedent): the segment awaits nothing, and
 * the stats query re-checks on every arrival (`REFETCH_ON_VISIT`) so opening
 * this page right after ending a session already counts that session.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Your quiz progress',
    description: 'Your average score, accuracy, and how your scores move over time.',
    robots: { index: false, follow: false },
  };
}

/** Same router-cache lever and safety argument as `/quiz` above it — the
 *  segment awaits nothing, so a re-used payload cannot show stale data. */
export const unstable_dynamicStaleTime = 300;

export default function V2QuizStatsPage() {
  return <StatsScreen />;
}
