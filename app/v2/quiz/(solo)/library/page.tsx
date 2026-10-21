import type { Metadata } from 'next';
import { LibraryScreen } from '@/v2/features/quiz/solo/library/LibraryScreen';

/**
 * v2 `/quiz/library` — server shell for the reader's own quizzes.
 *
 * PRIVATE surface (an account's own library), so the `/quiz/history`
 * treatment: a bare title, a description, and `robots: noindex`. No canonical,
 * no OG card — nothing here is crawlable and advertising it would only
 * promise a sign-in wall.
 *
 * NO SERVER PREFETCH, deliberately (the `/radars` precedent): the segment
 * awaits nothing, the client query cache owns the rows and paints them
 * instantly on return visits (30-minute `gcTime`), and `REFETCH_ON_VISIT`
 * re-checks on every arrival.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'My quizzes',
    description:
      'The quizzes you wrote: take one yourself, run it in a channel, or share it by link.',
    robots: { index: false, follow: false },
  };
}

/** Same router-cache lever and safety argument as `/quiz` above it — the
 *  segment awaits nothing, so a re-used payload cannot show stale data. */
export const unstable_dynamicStaleTime = 300;

export default function V2QuizLibraryPage() {
  return <LibraryScreen />;
}
