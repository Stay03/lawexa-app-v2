import type { Metadata } from 'next';
import { AttemptResultsScreen } from '@/v2/features/quiz/solo/results/AttemptResultsScreen';

/**
 * v2 `/quiz/attempts/[attemptUuid]/results` — server shell for one finished
 * attempt's review.
 *
 * PRIVATE surface: the attempt answers only its owner, so the metadata is a
 * bare generic title + noindex (the practice results' precedent). The score
 * stays out of the tab title on purpose: it is per-user data, and fetching
 * it here would put a Laravel round trip in front of every hard load to
 * render a number that is already the biggest thing on the page.
 *
 * The CHILD of the attempt it reviews, which is what lets the segment
 * boundary above it draw this page's shape on the play → results hand-off.
 */
interface AttemptResultsPageProps {
  params: Promise<{ attemptUuid: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: 'Quiz results',
    description: 'Your score and every answer for a finished quiz.',
    robots: { index: false, follow: false },
  };
}

/** Same router-cache lever and safety argument as the practice results page:
 *  the segment awaits nothing, and a finished attempt never changes. */
export const unstable_dynamicStaleTime = 300;

export default async function V2QuizAttemptResultsPage({ params }: AttemptResultsPageProps) {
  const { attemptUuid } = await params;
  return <AttemptResultsScreen attemptUuid={attemptUuid} />;
}
