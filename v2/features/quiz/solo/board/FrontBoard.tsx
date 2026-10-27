'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { QuizLeaderboard, QuizLeaderboardEntry } from '@/types/channel-quiz';
import { MemberAvatar } from '@/v2/features/channels/ui/avatars';
import { BOARD_EMPTY_NOTE, BOARD_RULES_NOTE, playerDetailLabel, playersLabel, rankLabel, scoreLabel } from '../home-model';

/** The board's length on the quiz page: the podium and the rest of the top ten. */
const BOARD_TOP = 10;

/**
 * FrontBoard — a public quiz's leaderboard on its own page (Arthur, 27 October
 * 2026: "use a top-three podium on the quiz detail page and top 10
 * leaderboard. Visually distinguish the user's row from other players").
 *
 *   the podium     2 | 1 | 3 on B1's raised blocks, first place tallest and gold
 *   the list       places 4 to 10
 *   your row       tinted and marked "You"; added under the ten when you are
 *                  further down, with your real place
 *
 * The rule that ranks it is said at the foot, in one line.
 */
export function FrontBoard({ board }: { board: QuizLeaderboard }) {
  const viewer = board.viewer;
  const isYou = (entry: QuizLeaderboardEntry) =>
    viewer !== null && entry.rank === viewer.rank && entry.points === viewer.points;
  const podium = board.entries.slice(0, 3);
  const rest = board.entries.slice(3, BOARD_TOP);
  const youShown = board.entries.slice(0, BOARD_TOP).some(isYou);
  const players = playersLabel(board.player_count);

  return (
    <section aria-labelledby="quiz-front-board" className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="quiz-front-board" className="text-base font-semibold text-foreground">
          Leaderboard
        </h2>
        {players ? <span className="text-[13px] text-muted-foreground tabular-nums">{players}</span> : null}
      </div>

      {podium.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {BOARD_EMPTY_NOTE}
        </p>
      ) : (
        <>
          <Podium entries={podium} isYou={isYou} />

          {rest.length > 0 || (viewer && !youShown) ? (
            <ol aria-label="Places 4 to 10" className="flex flex-col gap-1">
              {rest.map((entry) => (
                <BoardRow key={`${entry.rank}-${entry.user.uuid}`} entry={entry} you={isYou(entry)} />
              ))}
              {viewer && !youShown ? (
                <>
                  <li aria-hidden className="py-1 text-center text-xs text-muted-foreground">
                    ···
                  </li>
                  <YourRow rank={viewer.rank} points={viewer.points} playerCount={board.player_count} />
                </>
              ) : null}
            </ol>
          ) : null}
        </>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">{BOARD_RULES_NOTE}</p>
    </section>
  );
}

/** Heights of the podium's blocks, by place. */
const BLOCK: Record<number, string> = { 1: 'h-24', 2: 'h-16', 3: 'h-12' };

function Podium({ entries, isYou }: { entries: readonly QuizLeaderboardEntry[]; isYou: (entry: QuizLeaderboardEntry) => boolean }) {
  // 2 | 1 | 3, so the first place stands in the middle.
  const order = [entries[1], entries[0], entries[2]];
  return (
    <ol aria-label="Top three" className="grid grid-cols-3 items-end gap-2 sm:gap-3">
      {order.map((entry, column) => {
        if (!entry) return <li key={`empty-${column}`} aria-hidden />;
        const place = column === 1 ? 1 : column === 0 ? 2 : 3;
        const first = place === 1;
        const you = isYou(entry);
        return (
          <li key={entry.user.uuid} className="flex min-w-0 flex-col items-center gap-2 text-center">
            <MemberAvatar
              user={{ name: entry.user.name, avatar_url: entry.user.avatar_url ?? null }}
              size={first ? 'lg' : 'default'}
              className={cn(you && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
            />
            <span className="flex w-full min-w-0 flex-col leading-tight">
              <span className={cn('truncate text-[13px] font-semibold', you ? 'text-[var(--solo-gold-text)]' : 'text-foreground')}>
                {you ? 'You' : entry.user.name}
              </span>
              <span className="font-comfortaa text-[15px] font-bold text-foreground tabular-nums">
                {scoreLabel(entry.points)}
                <span className="sr-only"> points</span>
              </span>
            </span>
            <span
              aria-label={`Place ${entry.rank}`}
              className={cn(
                'v2-solo-lip flex w-full items-start justify-center rounded-t-xl rounded-b-md pt-2 font-comfortaa text-xl font-bold',
                BLOCK[place],
                first
                  ? 'bg-primary text-primary-foreground [--lip:var(--solo-gold-deep)]'
                  : 'border-2 border-border bg-card text-muted-foreground',
              )}
            >
              {entry.rank}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One place under the podium: rank, face, name, where they study (to an account), points, right answers. */
function BoardRow({ entry, you }: { entry: QuizLeaderboardEntry; you: boolean }) {
  const detail = playerDetailLabel(entry.user);
  return (
    <li
      className={cn(
        'flex min-h-14 min-w-0 items-center gap-3 rounded-xl px-3 py-2',
        you ? 'border-2 border-primary/50 bg-primary/10' : 'border-2 border-transparent',
      )}
    >
      <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground tabular-nums">
        <span className="sr-only">Place </span>
        {entry.rank}
      </span>
      <MemberAvatar user={{ name: entry.user.name, avatar_url: entry.user.avatar_url ?? null }} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{entry.user.name}</span>
          {you ? <YouPill /> : null}
        </span>
        {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      <span className="flex shrink-0 flex-col items-end leading-tight">
        <span className="font-comfortaa text-[15px] font-bold text-foreground tabular-nums">
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

/** The reader's own place when it is below the ten: the server sends it even then. */
function YourRow({ rank, points, playerCount }: { rank: number; points: number; playerCount: number }) {
  return (
    <li className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl border-2 border-primary/50 bg-primary/10 px-3 py-2">
      <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground tabular-nums">{rank}</span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <YouPill />
        <span className="text-xs text-muted-foreground tabular-nums">{rankLabel(rank, playerCount)}</span>
      </span>
      <span className="font-comfortaa text-[15px] font-bold text-foreground tabular-nums">
        {scoreLabel(points)}
        <span className="sr-only"> points</span>
      </span>
    </li>
  );
}

function YouPill() {
  return (
    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">You</span>
  );
}

/** The board's reserved shape while it is read. */
export function FrontBoardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      <Skeleton className="h-5 w-28 rounded" />
      <div className="grid grid-cols-3 items-end gap-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-xl" style={{ opacity: 1 - index * 0.25 }} />
      ))}
    </div>
  );
}
