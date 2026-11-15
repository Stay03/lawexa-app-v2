'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { GameOverlay } from '@/v2/features/channels/quiz/GameOverlay';
import { gameRoom } from '@/v2/features/channels/quiz/quiz-room';
import { useOpenQuizLive } from '@/v2/features/channels/quiz/use-open-quiz-live';
import { EXPLORE_HREF } from '@/v2/features/quiz/solo/model';
import { useV2Session } from '@/v2/runtime/session-context';

/**
 * OpenGameScreen — an open game, played on its own page (live quiz without a
 * Space). The SAME game screen as a Space game (`GameOverlay`: lobby,
 * questions, reveal, podium), over the whole window; only its room differs:
 * the game is its own (`gameRoom`), with its events on `quiz-games.{uuid}`
 * (`useOpenQuizLive`). Leaving goes back to the Quiz page, where Live now and
 * the code entry are.
 */
export function OpenGameScreen({ gameUuid }: { gameUuid: string }) {
  const router = useRouter();
  const { userId, userUuid, signedIn } = useV2Session();
  useOpenQuizLive(gameUuid, signedIn);
  const close = useCallback(() => router.push(EXPLORE_HREF), [router]);

  return (
    <GameOverlay
      room={gameRoom(gameUuid)}
      cover="viewport"
      gameUuid={gameUuid}
      viewerId={userId}
      viewerUuid={userUuid}
      place="Quiz page"
      onClose={close}
    />
  );
}
