'use client';

import { memo } from 'react';
import Link from 'next/link';
import { Target } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChannelQuiz } from '@/types/channel-quiz';
import { MemberAvatar } from '@/v2/features/channels/ui/avatars';
import { useV2Session } from '@/v2/runtime/session-context';
import { scoreLabel } from '../home-model';
import { ownScore, ownScoreLabel, scoreToBeatView } from '../retake-model';
import { quizFrontHref } from '../model';
import { QuizTags } from '../QuizTags';
import { QuizTile } from '../QuizTile';

/**
 * ExploreQuizCard — one public quiz on the Quiz home (Arthur, 27 and 28
 * October 2026: "The first image is close to what I want but the colors ...
 * its too much. You can leave just the card. The rest should be minimal even
 * including the personal best number color").
 *
 *   (T) Title, in its own weight         the quiz's letter tile, its colour
 *   [Land Law] [300 Level] [2025]        quiet tags
 *   ┌ (o) Score to Beat       9,480 ┐  the highest score ever, on a gold tray
 *   └ (face) Bola Ade  on 3 attempts ┘  (an older server: the board's first place)
 *   Your best 1,926                     once played
 *
 * Colour lives on the tile only, and no play button (Arthur, 28 October
 * 2026: "Remove the play button"): the whole card is the one link (the
 * title's `after:` layer), raised on B1's lip.
 */

const CARD = 'v2-solo-lip relative flex min-w-0 flex-col gap-3 rounded-2xl border-2 border-border bg-card p-4';

export const ExploreQuizCard = memo(function ExploreQuizCard({ quiz }: { quiz: ChannelQuiz }) {
  const { userUuid } = useV2Session();
  // The Score to Beat (Arthur, 25 November 2026): the highest score ever, which
  // a retake can take. An older server sends only the board's first place.
  const toBeat = scoreToBeatView(quiz.leaderboard?.score_to_beat, userUuid);
  const top = quiz.leaderboard?.top ?? null;
  const leading = quiz.leaderboard?.viewer_rank === 1;
  const caption = leading ? 'You lead' : 'To beat';
  // The reader's board score: on a listed quiz the first attempt, never the best (retakes are practice).
  const own = ownScore(quiz);

  return (
    <li className={cn(CARD, 'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring')}>
      <div className="flex min-w-0 items-start gap-3">
        <QuizTile uuid={quiz.uuid} title={quiz.title} size="md" />
        <Link
          href={quizFrontHref(quiz.uuid)}
          className="line-clamp-2 pt-0.5 text-[17px] leading-snug font-bold tracking-[-0.01em] text-foreground outline-none after:absolute after:inset-0 after:rounded-2xl"
        >
          {quiz.title}
        </Link>
      </div>

      <QuizTags quiz={quiz} />

      {toBeat ? (
        // The Score to Beat lives on the card only (Arthur, 25 November 2026,
        // 17:21: "it distracts from the leaderboard ... it should only show in
        // the quiz list"), with the attempt that reached it.
        <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/6 px-3 py-2.5">
          <span className="flex min-w-0 items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
              <Target aria-hidden className="size-3.5" />
              Score to Beat
            </span>
            <span className="shrink-0 font-comfortaa text-lg leading-none font-bold text-foreground tabular-nums">
              {toBeat.points}
              <span className="sr-only"> points</span>
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <MemberAvatar user={{ name: toBeat.holder, avatar_url: toBeat.avatarUrl }} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{toBeat.you ? 'You hold it' : toBeat.holder}</span>
            {toBeat.attempts ? <span className="shrink-0 text-xs text-muted-foreground">{toBeat.attempts}</span> : null}
          </span>
        </div>
      ) : top ? (
        <div className="flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl bg-secondary/70 px-3">
          <MemberAvatar user={{ name: top.name, avatar_url: top.avatar_url }} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[11px] font-medium text-muted-foreground">{caption}</span>
            <span className="truncate text-sm font-semibold text-foreground">{leading ? 'You' : top.name}</span>
          </span>
          <span className="shrink-0 font-comfortaa text-base font-bold text-foreground tabular-nums">
            {scoreLabel(top.points)}
            <span className="sr-only"> points</span>
          </span>
        </div>
      ) : (
        <div className="flex min-h-12 items-center rounded-xl bg-secondary/70 px-3 text-sm text-muted-foreground">
          Be the first to play
        </div>
      )}

      {own ? (
        <span className="mt-auto flex min-w-0 items-baseline gap-1.5">
          <span className="text-xs text-muted-foreground">{ownScoreLabel(own.kind)}</span>
          <span className="font-comfortaa text-base font-bold text-foreground tabular-nums">{scoreLabel(own.points)}</span>
        </span>
      ) : null}
    </li>
  );
});

/** The cards' grid: one a row on a phone, two on a tablet, three on a computer. */
export const EXPLORE_CARD_GRID = 'v2-solo grid grid-cols-1 gap-4 pb-1 sm:grid-cols-2 xl:grid-cols-3';

/** One card at its real geometry. */
function ExploreQuizCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-border/60 p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-[14px]" />
        <Skeleton className="mt-1 h-5 w-3/4 rounded" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-4 w-1/3 rounded" />
    </div>
  );
}

export function ExploreQuizCardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div aria-hidden className={EXPLORE_CARD_GRID}>
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.3, 1 - Math.floor(index / 3) * 0.25) }}>
          <ExploreQuizCardSkeleton />
        </div>
      ))}
    </div>
  );
}
