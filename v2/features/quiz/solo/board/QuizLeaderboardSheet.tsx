'use client';

import { useQuery } from '@tanstack/react-query';
import { Info, Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import type { QuizLeaderboard, QuizLeaderboardEntry } from '@/types/channel-quiz';
import { MemberAvatar } from '@/v2/features/channels/ui/avatars';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { QuizMessage } from '../../ui/QuizMessage';
import { QuizErrorState } from '../../ui/states';
import {
  BOARD_EMPTY_NOTE,
  BOARD_RULES_NOTE,
  playerDetailLabel,
  playersLabel,
  rankLabel,
  scoreLabel,
} from '../home-model';
import { soloQuizQueries } from '../queries';

/**
 * QuizLeaderboardSheet — a public quiz's full leaderboard (Arthur's quiz
 * list, part 6: "let users tap through to the full leaderboard"), opened from
 * the leaderboard button on an Explore card and from "See all" on the quiz's
 * page. A whole-screen sheet on a phone, a card on a computer.
 *
 * ── YOUR PLACE FIRST, THEN THE BOARD ──────────────────────────────────────
 * The reader's own rank and best lead, in their own box, so their best is
 * never read as the score to beat (Arthur: "clearly distinguish a user's
 * personal best from the score to beat"). The server sends their real rank
 * even when it is outside the rows listed.
 *
 * ── WHO IS SHOWN ───────────────────────────────────────────────────────────
 * A name and a face for anyone; where they study and their level for a
 * signed-in reader (option a, Stay). The server decides what is in the body;
 * this draws what is there and leaves out what is not.
 *
 * Ranked by each player's best, equal points share a rank, and the rule is
 * said at the foot (Arthur: "make the scoring rules transparent").
 */
export function QuizLeaderboardSheet({
  quizUuid,
  quizTitle,
  open,
  onOpenChange,
  viewerId,
}: {
  quizUuid: string;
  /** Said under the heading, so the board names its quiz. */
  quizTitle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewerId: number | null;
}) {
  const query = useQuery({
    ...soloQuizQueries.leaderboard(quizUuid, { viewerId }),
    enabled: open,
  });
  const board = query.data?.data ?? null;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      className="md:max-w-lg"
      title="Leaderboard"
      description={quizTitle ?? undefined}
    >
      {query.isPending ? (
        <BoardSkeleton />
      ) : query.isError || !board ? (
        extractApiError(query.error).status === 404 ? (
          <QuizMessage
            icon={Trophy}
            title="No leaderboard for this quiz"
            description="Only quizzes on the public list have a leaderboard."
          />
        ) : (
          <QuizErrorState
            title="Couldn't load the leaderboard"
            description="Something went wrong on our side. Please try again."
            onRetry={() => void query.refetch()}
          />
        )
      ) : (
        <BoardBody board={board} />
      )}
    </ResponsiveOverlay>
  );
}

function BoardBody({ board }: { board: QuizLeaderboard }) {
  const players = playersLabel(board.player_count);
  return (
    <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {board.viewer ? (
        <div className="flex items-end justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div>
            <div className="text-xs text-muted-foreground">Your best</div>
            <div className="font-comfortaa text-lg font-bold text-foreground tabular-nums">
              {scoreLabel(board.viewer.points)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Your rank</div>
            <div className="text-sm font-semibold text-foreground tabular-nums">
              {rankLabel(board.viewer.rank, board.player_count)}
            </div>
          </div>
        </div>
      ) : null}

      {board.entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{BOARD_EMPTY_NOTE}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {players ? <p className="text-xs text-muted-foreground tabular-nums">{players}</p> : null}
          <ol aria-label="Players by best score" className="flex flex-col">
            {board.entries.map((entry) => (
              <BoardRow key={`${entry.rank}-${entry.user.uuid}`} entry={entry} />
            ))}
          </ol>
          {board.player_count > board.entries.length ? (
            <p className="text-xs text-muted-foreground">
              Showing the top {board.entries.length}.
            </p>
          ) : null}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground/80">
        <Info aria-hidden className="mt-px size-3.5 shrink-0" />
        <span>{BOARD_RULES_NOTE}</span>
      </p>
    </div>
  );
}

/** One player: their rank, face, name (and where they study, to an account),
 *  their best points, and how many they got right on that run. */
export function BoardRow({ entry }: { entry: QuizLeaderboardEntry }) {
  const detail = playerDetailLabel(entry.user);
  const podium = entry.rank <= 3;
  return (
    <li className="flex min-w-0 items-center gap-3 border-b border-border/60 py-2.5 last:border-b-0">
      <span
        className={cn(
          'w-7 shrink-0 text-center text-sm font-semibold tabular-nums',
          podium ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        <span className="sr-only">Rank </span>
        {entry.rank}
      </span>
      <MemberAvatar user={{ name: entry.user.name, avatar_url: entry.user.avatar_url ?? null }} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{entry.user.name}</span>
        {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="font-comfortaa text-sm font-bold text-foreground tabular-nums">
          {scoreLabel(entry.points)}
          <span className="sr-only"> points</span>
        </span>
        {entry.question_count > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {entry.correct_count}/{entry.question_count} right
          </span>
        ) : null}
      </span>
    </li>
  );
}

function BoardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 py-2.5"
          style={{ opacity: Math.max(0.3, 1 - index * 0.14) }}
        >
          <Skeleton className="h-4 w-5 rounded" />
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 flex-1 rounded" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}
