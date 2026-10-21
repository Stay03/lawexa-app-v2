import type { Metadata } from 'next';
import { AttemptPlayerScreen } from '@/v2/features/quiz/solo/player/AttemptPlayerScreen';

/**
 * v2 `/quiz/attempts/[attemptUuid]` — server shell for one attempt in play.
 *
 * PRIVATE surface: the attempt answers only its owner, so the metadata is a
 * bare generic title + noindex (the practice session's precedent). Nothing
 * about the attempt — not the quiz, not the score — reaches the tab title:
 * that is per-user data, and fetching it here would put a Laravel round trip
 * in front of every hard load to render a string the reader can already see.
 *
 * THE `(play)` ROUTE GROUP IS LOAD-BEARING and does not change the URL: it
 * exists so this page's skeleton lives in `(play)/loading.tsx` and wraps this
 * page only, leaving the `[attemptUuid]` segment boundary free to draw the
 * RESULTS shape for the one child navigated into it — the practice player's
 * arrangement, for the same reason.
 */
interface AttemptPageProps {
  params: Promise<{ attemptUuid: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: 'Quiz',
    description: 'Your quiz attempt.',
    robots: { index: false, follow: false },
  };
}

/** Same router-cache lever and safety argument as the practice session page:
 *  the segment awaits nothing, and the attempt query is on the live tier. */
export const unstable_dynamicStaleTime = 300;

export default async function V2QuizAttemptPage({ params }: AttemptPageProps) {
  const { attemptUuid } = await params;
  return <AttemptPlayerScreen attemptUuid={attemptUuid} />;
}
