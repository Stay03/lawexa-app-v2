'use client';

import { Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { QuizLeaderboard } from '@/types/channel-quiz';
import { BOARD_EMPTY_NOTE, playersLabel, scoreLabel } from '../home-model';
import { BoardRow } from './QuizLeaderboardSheet';

/** How many players the quiz's page lists before "See full leaderboard". */
const FRONT_BOARD_ROWS = 3;

/**
 * FrontBoard — a public quiz's leaderboard on its own page (Arthur's quiz
 * list, part 6): the score to beat with its player, the top few, and the way
 * to the full board. The reader's own best and rank stay in the start panel,
 * apart from this (Arthur: "clearly distinguish a user's personal best from
 * the score to beat").
 */
export function FrontBoard({
  board,
  onSeeAll,
}: {
  board: QuizLeaderboard;
  onSeeAll: () => void;
}) {
  const top = board.entries[0] ?? null;
  const players = playersLabel(board.player_count);

  return (
    <section
      aria-labelledby="quiz-front-board"
      className="flex flex-col gap-3 rounded-2xl border-2 border-border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="quiz-front-board" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Trophy aria-hidden className="size-4 text-primary" />
          Leaderboard
        </h2>
        {players ? <span className="text-xs text-muted-foreground tabular-nums">{players}</span> : null}
      </div>

      {top ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Score to beat</div>
              <div className="truncate text-sm font-medium text-foreground/85">{top.user.name}</div>
            </div>
            <div className="font-comfortaa text-xl font-bold text-foreground tabular-nums">
              {scoreLabel(top.points)}
            </div>
          </div>
          <ol aria-label="Top players" className="flex flex-col">
            {board.entries.slice(0, FRONT_BOARD_ROWS).map((entry) => (
              <BoardRow key={`${entry.rank}-${entry.user.uuid}`} entry={entry} />
            ))}
          </ol>
          <Button variant="outline" size="sm" className="self-start" onClick={onSeeAll}>
            See full leaderboard
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{BOARD_EMPTY_NOTE}</p>
      )}
    </section>
  );
}

/** The board's reserved shape while it is read, at its real geometry. */
export function FrontBoardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 rounded-2xl border-2 border-border/60 p-4">
      <Skeleton className="h-4 w-28 rounded" />
      <div className="flex items-end justify-between">
        <Skeleton className="h-8 w-32 rounded" />
        <Skeleton className="h-6 w-16 rounded" />
      </div>
      {Array.from({ length: FRONT_BOARD_ROWS }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full rounded" style={{ opacity: 1 - index * 0.25 }} />
      ))}
    </div>
  );
}
