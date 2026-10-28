'use client';

import { useState, type AnimationEvent } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { QuizLeaderboard, QuizLeaderboardEntry } from '@/types/channel-quiz';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { Podium } from '../board/FrontBoard';
import { isViewerEntry } from '../home-model';
import { quizFrontHref } from '../model';
import { soloQuizQueries } from '../queries';
import { prefersReducedMotion } from '../ui';
import { finishPosition } from './position-model';

/**
 * FinishPosition — the reader's place on the quiz's board, between "See your
 * answers" and the button bar (Arthur, 28 October 2026, on the empty space
 * under the fold): "You're #4 of 23 players", the "better than" line, View
 * leaderboard to the quiz page's own board, and the podium moment when this
 * run put them in the top three. The words are `finishPosition`'s; the board
 * is read after the finish, which writes the reader's row at once.
 *
 * QUIET WHEN IT CANNOT SAY. A board that fails to load leaves the space as
 * it was; the score above is the screen's news, and the place is a bonus.
 *
 * THE PODIUM MOMENT (drawn from Kahoot's end-of-game podium: the places come
 * in third, second, first, and a player's own screen is about them alone) is
 * the quiz page's podium (`Podium`, the same gold, pale blue and peach steps
 * and rounded-square faces) with the steps growing in and the reader's face
 * climbing onto theirs, about two seconds, once. Skip, or a tap on it, ends
 * it at once; under reduced motion it stands in place with no Skip.
 */
export function FinishPosition({
  quizUuid,
  runPoints,
  publicQuiz,
  viewerId,
}: {
  quizUuid: string;
  /** This run's points, to tell a new place from an older best. */
  runPoints: number;
  /** Whether the quiz is on the public list; `null` while its detail loads. */
  publicQuiz: boolean | null;
  viewerId: number | null;
}) {
  const boardQuery = useQuery(soloQuizQueries.leaderboard(quizUuid, { viewerId }));

  if (boardQuery.isPending) return <FinishPositionSkeleton />;
  if (boardQuery.isError || !boardQuery.data) return null;

  return <PositionBlock board={boardQuery.data.data} quizUuid={quizUuid} runPoints={runPoints} publicQuiz={publicQuiz} />;
}

function PositionBlock({
  board,
  quizUuid,
  runPoints,
  publicQuiz,
}: {
  board: QuizLeaderboard;
  quizUuid: string;
  runPoints: number;
  publicQuiz: boolean | null;
}) {
  const position = finishPosition(board, runPoints, { publicQuiz: publicQuiz !== false });
  const viewer = board.viewer;
  const isYou = (entry: QuizLeaderboardEntry) => isViewerEntry(viewer, entry);
  const boardLink = publicQuiz !== false && board.player_count > 0;

  return (
    <section
      aria-label="Your place on the leaderboard"
      className="mt-8 mb-6 flex flex-col items-center gap-3 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      {position.kind === 'ranked' && position.podiumPlace ? (
        <PodiumMoment entries={board.entries.slice(0, 3)} isYou={isYou} />
      ) : null}

      <p className="flex items-center gap-2 font-comfortaa text-lg font-bold text-balance text-foreground">
        {position.kind === 'ranked' ? <Trophy aria-hidden className="size-4 text-primary" /> : null}
        {position.line}
      </p>
      {position.kind === 'ranked' && position.standing ? (
        <p className="-mt-1.5 text-sm text-muted-foreground">{position.standing}</p>
      ) : null}

      {boardLink ? (
        <Link
          href={`${quizFrontHref(quizUuid)}#quiz-front-board`}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-primary underline-offset-2 hover:underline',
            FOCUS_RING,
          )}
        >
          View leaderboard
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : null}
    </section>
  );
}

/** The podium, rising once; Skip (or a tap) stands it in place. */
function PodiumMoment({
  entries,
  isYou,
}: {
  entries: readonly QuizLeaderboardEntry[];
  isYou: (entry: QuizLeaderboardEntry) => boolean;
}) {
  // Only a podium with the reader's face on it has a climb to end it (a reader
  // tied for third can sort fourth); without one it stands still from the start.
  const [playing, setPlaying] = useState(() => !prefersReducedMotion() && entries.some(isYou));
  const stop = () => setPlaying(false);
  const onAnimationEnd = (event: AnimationEvent) => {
    if (event.animationName === 'v2-solo-podium-climb') stop();
  };

  return (
    <div className="relative w-full max-w-sm">
      <div
        className={cn(!playing && 'v2-solo-podium-still')}
        onClick={playing ? stop : undefined}
        onAnimationEnd={onAnimationEnd}
      >
        <Podium entries={entries} isYou={isYou} rising />
      </div>
      {playing ? (
        <button
          type="button"
          onClick={stop}
          className={cn(
            'absolute top-0 right-0 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground motion-reduce:hidden',
            FOCUS_RING,
          )}
        >
          Skip
        </button>
      ) : null}
    </div>
  );
}

function FinishPositionSkeleton() {
  return (
    <div aria-hidden className="mt-8 flex flex-col items-center gap-2.5">
      <Skeleton className="h-6 w-48 rounded" />
      <Skeleton className="h-3.5 w-60 max-w-full rounded" />
    </div>
  );
}
