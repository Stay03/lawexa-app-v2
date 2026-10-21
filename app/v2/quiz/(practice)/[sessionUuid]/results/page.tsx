import type { Metadata } from 'next';
import { ResultsScreen } from '@/v2/features/quiz/results/ResultsScreen';

/**
 * v2 `/quiz/[sessionUuid]/results` — server shell for one session's review.
 *
 * PRIVATE surface: the results endpoint answers only its owner (and only after
 * the session has ended), so the metadata is a bare generic title + noindex —
 * the `/radars/[radarUuid]` precedent. The score stays out of the tab title on
 * purpose: it is per-user data, and fetching it here would put a Laravel round
 * trip in front of every hard load to render a number that is already the
 * biggest thing on the page.
 *
 * v1 lived at `/quiz/[uuid]/results` too, but as a sibling of `/quiz/play`; in
 * v2 it is the CHILD of the session it reviews, which is what lets the segment
 * boundary above it draw this page's shape on the play → results hand-off.
 */
interface QuizResultsPageProps {
  params: Promise<{ sessionUuid: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: 'Session results',
    description: 'Your answers and explanations for a finished quiz session.',
    robots: { index: false, follow: false },
  };
}

/** Same router-cache lever and safety argument as `/quiz` above it: the segment
 *  awaits nothing, so a re-used payload cannot show stale data. A finished
 *  session's results are frozen anyway — the query sits on the `reference`
 *  tier for exactly that reason. */
export const unstable_dynamicStaleTime = 300;

export default async function V2QuizResultsPage({
  params,
}: QuizResultsPageProps) {
  const { sessionUuid } = await params;
  return <ResultsScreen sessionUuid={sessionUuid} />;
}
