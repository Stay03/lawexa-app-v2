'use client';

import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react';
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
import { Confetti } from './Confetti';
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
  // Only a public quiz has a board: a link-only or private one answers 404
  // (Tester, 28 October 2026: twice a finish, on load and on the finish's
  // refresh). Asked for once the quiz is known to be public; a disabled read
  // is never refetched, so the finish's refresh sends nothing either.
  const boardQuery = useQuery({
    ...soloQuizQueries.leaderboard(quizUuid, { viewerId }),
    enabled: publicQuiz === true,
  });

  if (publicQuiz === false) return null;
  if (publicQuiz === null || boardQuery.isPending) return <FinishPositionSkeleton />;
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
      {/* The quiz's visibility decides whether "Challenge a friend" joins
          the bar, so the bar has its final height only once it is known. */}
      {position.kind === 'ranked' && position.podiumPlace ? (
        <PodiumMoment entries={board.entries.slice(0, 3)} isYou={isYou} barSettled={publicQuiz !== null} />
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

/** Unseen below the fold, then rising, then standing. */
type MomentPhase = 'waiting' | 'playing' | 'still';

/** How much of the podium, clear of the button bar, counts as seen. */
const PODIUM_SEEN_SHARE = 0.6;

/** When the steps have landed (the first place's grows from 400ms for 500ms) and the confetti bursts. */
const PODIUM_LANDS_MS = 900;

/**
 * The podium, rising once, under "You made the Podium!" (Arthur, 28 October
 * 2026: "isn't celebratory enough"), with a burst of confetti from its
 * centre as the steps land (`Confetti`). Skip, or a tap, stands the podium
 * in place and clears the confetti at once. Under reduced motion the
 * headline and the podium stand still and no confetti falls.
 */
function PodiumMoment({
  entries,
  isYou,
  barSettled,
}: {
  entries: readonly QuizLeaderboardEntry[];
  isYou: (entry: QuizLeaderboardEntry) => boolean;
  /** The button bar is at its final height: until then what it covers is not known. */
  barSettled: boolean;
}) {
  const onPodium = entries.some(isYou);
  // Only a podium with the reader's face on it has a climb to end it (a reader
  // tied for third can sort fourth); without one it stands still from the start.
  // It waits, unseen, until it is on screen: on a phone it is below the fold.
  const [phase, setPhase] = useState<MomentPhase>(() => (!prefersReducedMotion() && onPodium ? 'waiting' : 'still'));
  const playing = phase === 'playing';
  const [confettiFrom, setConfettiFrom] = useState<{ x: number; y: number } | null>(null);
  const podiumRef = useRef<HTMLDivElement>(null);
  const stop = () => {
    setPhase('still');
    setConfettiFrom(null);
  };
  const onAnimationEnd = (event: AnimationEvent) => {
    if (event.animationName === 'v2-solo-podium-climb') setPhase('still');
  };

  useEffect(() => {
    if (phase !== 'waiting' || !barSettled) return;
    const podium = podiumRef.current;
    if (!podium) return;
    // The button bar sits over the foot of the screen (three rows tall on a
    // phone), so the part it covers does not count as seen: otherwise the
    // podium rises behind the bar with only the headline showing. A podium
    // already inside the window but under the bar crosses no visibility
    // threshold as the reader scrolls, so it looks on every scroll and resize
    // (once a frame), measuring the bar each time.
    const seen = () => {
      const box = podium.getBoundingClientRect();
      const barTop = document.querySelector<HTMLElement>('[data-results-bar]')?.getBoundingClientRect().top ?? window.innerHeight;
      const shown = Math.min(box.bottom, window.innerHeight, barTop) - Math.max(box.top, 0);
      return box.height > 0 && shown / box.height >= PODIUM_SEEN_SHARE;
    };
    let frame = 0;
    const look = () => {
      frame = 0;
      if (seen()) setPhase('playing');
    };
    const onMove = () => {
      if (!frame) frame = window.requestAnimationFrame(look);
    };
    // The first look too, in a frame: the podium may already be in view.
    onMove();
    // Capture, because the page scrolls inside the shell, not the window.
    document.addEventListener('scroll', onMove, { capture: true, passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('scroll', onMove, { capture: true });
      window.removeEventListener('resize', onMove);
    };
  }, [phase, barSettled]);
  const endConfetti = useCallback(() => setConfettiFrom(null), []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const box = podiumRef.current?.getBoundingClientRect();
      if (box) setConfettiFrom({ x: box.left + box.width / 2, y: box.top + box.height * 0.55 });
    }, PODIUM_LANDS_MS);
    // A Skip before the steps land cancels the burst.
    return () => window.clearTimeout(timer);
  }, [playing]);

  const celebrating = playing || confettiFrom !== null;

  return (
    <div className="relative flex w-full max-w-sm flex-col items-center">
      {onPodium ? (
        <p
          className={cn(
            'font-comfortaa text-2xl font-bold text-balance text-primary',
            phase === 'waiting' && 'opacity-0',
            playing && 'v2-solo-podium-headline',
          )}
        >
          You made the Podium!
        </p>
      ) : null}
      <div
        ref={podiumRef}
        className={cn('w-full', phase === 'waiting' && 'opacity-0', !playing && 'v2-solo-podium-still')}
        onClick={celebrating ? stop : undefined}
        onAnimationEnd={onAnimationEnd}
      >
        <Podium entries={entries} isYou={isYou} rising={playing} />
      </div>
      {celebrating ? (
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
      {confettiFrom ? <Confetti origin={confettiFrom} onDone={endConfetti} /> : null}
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
