import type { Metadata } from 'next';
import { PlayerScreen } from '@/v2/features/quiz/player/PlayerScreen';

/**
 * v2 `/quiz/[sessionUuid]` — server shell for one live practice session.
 *
 * PRIVATE surface: the session endpoint answers only its owner, so there is no
 * crawler-visible content and the metadata is a bare generic title + noindex
 * (the `/radars/[radarUuid]` precedent). Nothing about the session — not the
 * score, not the question — reaches the tab title: that is per-user data, and
 * fetching it here would put a Laravel round trip in front of every hard load
 * to render a string the reader can already see.
 *
 * The route REPLACES v1's `/quiz/play?s=<uuid>`: the session belongs in the
 * path, not in a query string, and this makes the results page its child.
 *
 * THE `(play)` ROUTE GROUP IS LOAD-BEARING and does not change the URL: it
 * exists so this page's skeleton lives in `(play)/loading.tsx` and wraps this
 * page only, leaving the `[sessionUuid]` segment boundary free to draw the
 * RESULTS shape for the one child navigated into it. See that file.
 */
interface QuizSessionPageProps {
  params: Promise<{ sessionUuid: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: 'Practice session',
    description: 'Your live quiz session.',
    robots: { index: false, follow: false },
  };
}

/** Same router-cache lever and safety argument as `/quiz` above it: the segment
 *  awaits nothing, so a re-used payload cannot show stale data — the session
 *  query is on the `live` tier and refetches on mount regardless. */
export const unstable_dynamicStaleTime = 300;

export default async function V2QuizSessionPage({
  params,
}: QuizSessionPageProps) {
  const { sessionUuid } = await params;
  return <PlayerScreen sessionUuid={sessionUuid} />;
}
