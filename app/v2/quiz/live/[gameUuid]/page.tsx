import type { Metadata } from 'next';

import { QuizAccessGate } from '@/v2/features/quiz/access';
import { OpenGameScreen } from '@/v2/features/quiz/live/OpenGameScreen';

/**
 * v2 `/quiz/live/[gameUuid]` — an open live quiz game: one with no Space or
 * channel, public or by link (live quiz without a Space, Backend
 * live-quiz-open e9c7ac18). Its link and QR land here; the game is played
 * where it opens, over the whole window, as a Space game is over its Space.
 *
 * The fixed `live` segment wins over `(practice)/[sessionUuid]`, as `q` does
 * for a quiz's front. Never indexed: a game by link is for the people it is
 * sent to, and a public one lasts minutes.
 */
export const metadata: Metadata = {
  title: 'Live quiz',
  robots: { index: false, follow: false },
};

interface OpenGamePageProps {
  params: Promise<{ gameUuid: string }>;
}

export default async function OpenGamePage({ params }: OpenGamePageProps) {
  const { gameUuid } = await params;
  return (
    <QuizAccessGate surface="solo">
      <OpenGameScreen gameUuid={gameUuid} />
    </QuizAccessGate>
  );
}
