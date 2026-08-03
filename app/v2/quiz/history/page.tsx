import type { Metadata } from 'next';
import { HistoryScreen } from '@/v2/features/quiz/history/HistoryScreen';

/**
 * v2 `/quiz/history` — server shell for the past-sessions list.
 *
 * PRIVATE surface, so the `/conversations` treatment: a bare title, a
 * description, and `robots: noindex`. No canonical, no OG card — nothing here
 * is crawlable and advertising it would only promise a sign-in wall.
 *
 * NO SERVER PREFETCH, deliberately (the `/radars` precedent): the segment
 * awaits nothing, the client query cache owns the rows and paints them
 * instantly on return visits (30-minute `gcTime`), and `REFETCH_ON_VISIT`
 * re-checks on every arrival — which matters because a session can end or
 * auto-abandon while the reader is elsewhere.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Quiz history',
    description: 'Your past practice sessions and their scores.',
    robots: { index: false, follow: false },
  };
}

/** Same router-cache lever and safety argument as `/quiz` above it — the
 *  segment awaits nothing, so a re-used payload cannot show stale data. */
export const unstable_dynamicStaleTime = 300;

export default function V2QuizHistoryPage() {
  return <HistoryScreen />;
}
