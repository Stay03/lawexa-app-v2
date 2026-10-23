'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChannelQuiz } from '@/types/channel-quiz';
import { quizFrontHref } from './model';
import { QuizTile } from './QuizTile';
import { bestOrNotTaken, quizFactsLabel } from './rows-model';

/**
 * QuizCard — one quiz on the Quiz home, in the small-card grid Stay picked
 * (version C, 23 October 2026: "let's do C I kinda like it"). Two across on a
 * phone, four on a computer (`QUIZ_CARD_GRID`), the same card on both tabs:
 *
 *   tile ····· menu        the menu on My quizzes only
 *   Title over at most     always two lines tall, so a row of cards lines up
 *   two lines
 *   Author                 Explore only
 *   10 questions · 5 min   the one fact line
 *               Best 4,210 or "Not taken" once the reader has an account
 *
 * The whole card opens the quiz: the title's link stretches over it (an
 * `after:` layer), and the menu sits above that layer as a SIBLING, never a
 * button inside a link.
 */

export const QUIZ_CARD_GRID = 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4';

export function QuizCard({
  quiz,
  index,
  signedIn,
  author,
  menu,
  children,
}: {
  quiz: ChannelQuiz;
  /** Staggers the entrance for the first screenful only. */
  index: number;
  /** "Not taken" is said only to an account, which a best could belong to. */
  signedIn: boolean;
  /** Who wrote it, on Explore; `undefined` on the reader's own list. */
  author?: string;
  /** The owner's ··· menu, on My quizzes. */
  menu?: React.ReactNode;
  /** A line said under the card's facts (a refused switch, "Link copied"). */
  children?: React.ReactNode;
}) {
  const count = quiz.question_count ?? quiz.questions?.length ?? 0;
  const best = bestOrNotTaken(quiz.viewer_best_points, signedIn);

  return (
    <li
      className="relative flex min-w-0 flex-col gap-1.5 rounded-2xl border border-border bg-card p-3 transition-colors has-[a:hover]:border-primary/40 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200"
      style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      <div className="flex h-8 items-center justify-between">
        <QuizTile uuid={quiz.uuid} title={quiz.title} size="sm" />
        {menu ? <div className="relative z-10 -mr-1.5">{menu}</div> : null}
      </div>
      <Link
        href={quizFrontHref(quiz.uuid)}
        className="v2-interactive mt-1 line-clamp-2 min-h-[2.75em] text-sm leading-snug font-semibold text-foreground outline-none after:absolute after:inset-0 after:rounded-2xl hover:text-primary focus-visible:after:ring-2 focus-visible:after:ring-ring"
      >
        {quiz.title}
      </Link>
      {author !== undefined ? (
        <span className="truncate text-xs font-medium text-foreground/80">{author}</span>
      ) : null}
      <span className="truncate text-xs text-muted-foreground tabular-nums">
        {quizFactsLabel(count, quiz.total_seconds)}
      </span>
      {best ? (
        <span
          className={cn(
            'mt-auto self-end pt-1 text-xs whitespace-nowrap tabular-nums',
            best.taken ? 'font-comfortaa font-bold text-primary' : 'text-muted-foreground/70',
          )}
        >
          {best.label}
        </span>
      ) : null}
      {children}
    </li>
  );
}

/** One card at `QuizCard`'s geometry: tile, two title lines, the fact line, the best. */
function QuizCardSkeleton({ author }: { author: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border/60 p-3">
      <Skeleton className="size-7 rounded-lg" />
      <Skeleton className="mt-2.5 h-3.5 w-4/5 rounded" />
      <Skeleton className="h-3.5 w-3/5 rounded" />
      {author ? <Skeleton className="mt-1 h-3 w-1/2 rounded" /> : null}
      <Skeleton className="mt-1 h-3 w-2/3 rounded" />
      <Skeleton className="mt-1 h-3 w-14 self-end rounded" />
    </div>
  );
}

/** The grid's loading state, in the v2 list fade, row by row. */
export function QuizCardGridSkeleton({ cards = 8, author = false }: { cards?: number; author?: boolean }) {
  return (
    <div aria-hidden className={QUIZ_CARD_GRID}>
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} style={{ opacity: Math.max(0.3, 1 - Math.floor(index / 2) * 0.2) }}>
          <QuizCardSkeleton author={author} />
        </div>
      ))}
    </div>
  );
}
