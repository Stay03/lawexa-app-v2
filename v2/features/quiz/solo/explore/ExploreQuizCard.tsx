'use client';

import { memo } from 'react';
import Link from 'next/link';
import { BadgeCheck, Play } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChannelQuiz } from '@/types/channel-quiz';
import { MemberAvatar } from '@/v2/features/channels/ui/avatars';
import { quizSubjectLabel, scoreLabel } from '../home-model';
import { quizFrontHref } from '../model';
import { quizFactsLabel } from '../rows-model';

/**
 * ExploreQuizCard — one public quiz on the Quiz home (Arthur, 27 October 2026:
 * "compact, premium, and minimal, inspired by Linear and Apple ... each quiz
 * card should prominently feature the quiz title and a compact person-to-beat
 * row with their avatar, name, and score in points. Show the user's best
 * score and rank where relevant. Keep cards clean, with a subtle play
 * action ... use the approved B1 design").
 *
 *   Title, in its own weight          two lines at most
 *   Author ✓ · Land Law · 2025        one quiet line
 *   ┌ (avatar) Bola Ade   2,820 pts ┐ the person to beat, on a tray
 *   You · #3 of 4 · 1,926       (▶)   once the reader has played; before
 *                                     that the facts, unless the quiet line
 *                                     already carries them (no subject)
 *
 * B1's lip is the card's press: the whole card is the one link (its title's
 * `after:` layer), raised 4px on the B1 lip and set down under a finger. The
 * play mark is that link's face, not a second control; a screen reader hears
 * the title once. No letter tile, no coloured block: the title and the number
 * to beat carry the card.
 */

const CARD = 'v2-solo-lip relative flex min-w-0 flex-col gap-3 rounded-2xl border-2 border-border bg-card p-4';

export const ExploreQuizCard = memo(function ExploreQuizCard({ quiz }: { quiz: ChannelQuiz }) {
  const author = quiz.is_mine ? 'You' : (quiz.creator?.name ?? 'Someone who has left');
  const subject = quizSubjectLabel(quiz);
  const count = quiz.question_count ?? quiz.questions?.length ?? 0;
  const board = quiz.leaderboard ?? null;
  const top = board?.top ?? null;
  const leading = board?.viewer_rank === 1;
  const best = typeof quiz.viewer_best_points === 'number' ? quiz.viewer_best_points : null;
  const rank = board?.viewer_rank ?? null;

  return (
    <li className={cn(CARD, 'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring')}>
      <div className="flex min-w-0 flex-col gap-1">
        <Link
          href={quizFrontHref(quiz.uuid)}
          className="line-clamp-2 text-[17px] leading-snug font-semibold tracking-[-0.01em] text-foreground outline-none after:absolute after:inset-0 after:rounded-2xl"
        >
          {quiz.title}
        </Link>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1">
            <span className="truncate">{author}</span>
            {quiz.creator?.is_verified_author ? (
              <>
                <BadgeCheck aria-hidden className="size-3.5 shrink-0 text-primary" />
                <span className="sr-only">, verified author</span>
              </>
            ) : null}
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{subject ?? quizFactsLabel(count, quiz.total_seconds)}</span>
        </span>
      </div>

      {top ? (
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-secondary/70 px-3 py-2">
          <MemberAvatar user={{ name: top.name, avatar_url: top.avatar_url }} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[11px] text-muted-foreground">{leading ? 'You lead' : 'To beat'}</span>
            <span className="truncate text-sm font-medium text-foreground">{leading ? 'You' : top.name}</span>
          </span>
          <span className="shrink-0 font-comfortaa text-base font-bold text-foreground tabular-nums">
            {scoreLabel(top.points)}
            <span className="ml-1 font-sans text-xs font-medium text-muted-foreground">pts</span>
          </span>
        </div>
      ) : (
        <div className="rounded-xl bg-secondary/70 px-3 py-2.5 text-sm text-muted-foreground">No one has played yet.</div>
      )}

      <div className="mt-auto flex min-h-9 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] text-muted-foreground tabular-nums">
          {best !== null && rank !== null ? (
            <>
              You · <span className="font-medium text-foreground">#{rank}</span>
              {board ? ` of ${board.player_count}` : ''} · <span className="font-comfortaa font-bold text-[var(--solo-gold-text)]">{scoreLabel(best)}</span>
            </>
          ) : subject ? (
            quizFactsLabel(count, quiz.total_seconds)
          ) : null}
        </span>
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card text-foreground"
        >
          <Play className="size-3.5 translate-x-px fill-current" />
        </span>
      </div>
    </li>
  );
});

/** The cards' grid: one a row on a phone, two on a tablet, three on a computer. */
export const EXPLORE_CARD_GRID = 'v2-solo grid grid-cols-1 gap-4 pb-1 sm:grid-cols-2 xl:grid-cols-3';

/** One card at its real geometry. */
function ExploreQuizCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-border/60 p-4">
      <Skeleton className="h-5 w-4/5 rounded" />
      <Skeleton className="h-3.5 w-1/2 rounded" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-2/5 rounded" />
        <Skeleton className="size-9 rounded-full" />
      </div>
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
