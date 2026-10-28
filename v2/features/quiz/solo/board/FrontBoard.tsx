'use client';

import { Crown, Info, Star, Trophy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { QuizLeaderboard, QuizLeaderboardEntry } from '@/types/channel-quiz';
import { MemberAvatar } from '@/v2/features/channels/ui/avatars';
import { useV2Session } from '@/v2/runtime/session-context';
import { BOARD_EMPTY_NOTE, BOARD_RULES_NOTE, playersLabel, podiumInstitution, scoreLabel, standingLine } from '../home-model';

/** The board's length on the quiz page: the podium and the rest of the top ten. */
const BOARD_TOP = 10;

/**
 * FrontBoard — a public quiz's leaderboard on its own page, drawn from
 * Arthur's two references (28 October 2026: a "Quiz App UI" board with the
 * reader's place on a banner, and a light one whose podium fades into the
 * page) in Lawexa's colours: "the leader board should show top 10 and if the
 * user is outside the 10 it shows the user under with its position ... let
 * the names have the players institution university or campus if it's law
 * school".
 *
 *   Leaderboard (i)                                   16 players
 *         (2)        ♛(1)        (3)      faces, names, where they
 *        2,754      3,880       2,820     study, points
 *       ░░ 2 ░░   ▓▓▓ 1 ▓▓▓   ░░ 3 ░░     pale blue, gold, peach blocks
 *                                          fading into the page
 *   🏆4 (face) Emeka Uche / Lagos State University        3,712
 *   ...to 10, then ··· and your own row, named like the others, with
 *   "You're doing better than 20% of other players." under it
 *
 * No card around it (Arthur, 28 October 2026: "Remove the outer card ... Let
 * the leaderboard, podium, and player rankings sit directly on the page's
 * normal background ... use subtle dividers between ranking rows, and retain
 * the gold highlight for the current user"). One column on a computer too
 * (Stay, 28 October 2026): the banner across it, the podium centred, the
 * rows under it at full width. The ranking rule sits behind the heading's (i).
 * Where a player studies is sent to a signed-in reader only (Backend: their
 * Law School campus when they are at law school, else their university); a
 * visitor sees names alone.
 */
export function FrontBoard({ board }: { board: QuizLeaderboard }) {
  const viewer = board.viewer;
  const isYou = (entry: QuizLeaderboardEntry) =>
    viewer !== null && entry.rank === viewer.rank && entry.points === viewer.points;
  const podium = board.entries.slice(0, 3);
  const rest = board.entries.slice(3, BOARD_TOP);
  const youShown = board.entries.slice(0, BOARD_TOP).some(isYou);
  const players = playersLabel(board.player_count);
  // "You're doing better than 20% of other players.": under the reader's own
  // row (Stay, 28 October 2026: the #13 banner repeated the place).
  const standing = viewer ? standingLine(viewer.rank, board.player_count) : null;

  return (
    <section
      aria-labelledby="quiz-front-board"
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="quiz-front-board" className="flex items-center gap-1 text-lg font-bold text-foreground">
          Leaderboard
          <Tooltip>
            <TooltipTrigger
              aria-label="How the board ranks"
              className="rounded-full p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info className="size-4" />
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{BOARD_RULES_NOTE}</TooltipContent>
          </Tooltip>
        </h2>
        {players ? <span className="text-sm text-muted-foreground tabular-nums">{players}</span> : null}
      </div>

      {podium.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {BOARD_EMPTY_NOTE}
        </p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:gap-6">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="mx-auto w-full min-w-0 md:max-w-lg">
              <Podium entries={podium} isYou={isYou} />
            </div>
            {/* On the podium the reader's line sits under it. */}
            {standing && podium.some(isYou) ? (
              <p className="text-center text-sm font-medium text-foreground/80">{standing}</p>
            ) : null}
          </div>

          {rest.length > 0 || (viewer && !youShown) ? (
            <div className="flex min-w-0 flex-col gap-1">
              {rest.length > 0 ? (
                <ol aria-label="Places 4 to 10" className="flex min-w-0 flex-col divide-y divide-border/70">
                  {rest.map((entry) => (
                    <BoardRow
                      key={`${entry.rank}-${entry.user.uuid}`}
                      entry={entry}
                      you={isYou(entry)}
                      standing={isYou(entry) ? standing : null}
                    />
                  ))}
                </ol>
              ) : null}
              {viewer && !youShown ? (
                <ol aria-label="Your place" className="flex min-w-0 flex-col gap-1">
                  <li aria-hidden className="py-1 text-center text-sm leading-none tracking-[0.3em] text-muted-foreground">
                    ···
                  </li>
                  <YourRow viewer={viewer} standing={standing} />
                </ol>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

/**
 * The podium's blocks, by place, as in Arthur's reference: a lighter top face
 * over a front that fades into the board, Lawexa's gold for the first, pale
 * blue and peach for the second and third.
 */
const BLOCK: Record<number, { front: string; top: string }> = {
  1: {
    front: 'h-28 from-[oklch(0.8_0.15_84)] sm:h-36',
    top: 'bg-[oklch(0.89_0.11_90)]',
  },
  2: {
    front: 'h-20 from-[oklch(0.78_0.08_262)] sm:h-28',
    top: 'bg-[oklch(0.88_0.05_262)]',
  },
  3: {
    front: 'h-16 from-[oklch(0.8_0.1_48)] sm:h-24',
    top: 'bg-[oklch(0.89_0.06_52)]',
  },
};

function Podium({ entries, isYou }: { entries: readonly QuizLeaderboardEntry[]; isYou: (entry: QuizLeaderboardEntry) => boolean }) {
  // 2 | 1 | 3, so the first place stands in the middle.
  const order = [entries[1], entries[0], entries[2]];
  return (
    <ol aria-label="Top three" className="grid grid-cols-[repeat(3,minmax(0,1fr))] items-end pt-6">
      {order.map((entry, column) => {
        if (!entry) return <li key={`empty-${column}`} aria-hidden />;
        const place = column === 1 ? 1 : column === 0 ? 2 : 3;
        const block = BLOCK[place];
        const you = isYou(entry);
        return (
          <li key={entry.user.uuid} className="flex min-w-0 flex-col items-center text-center">
            <span className="relative">
              {place === 1 ? (
                <Crown aria-hidden className="absolute -top-5 left-1/2 size-5 -translate-x-1/2 fill-primary text-primary" />
              ) : null}
              <MemberAvatar
                user={{ name: entry.user.name, avatar_url: entry.user.avatar_url ?? null }}
                className={cn(
                  'rounded-2xl ring-2 ring-offset-2 ring-offset-background after:rounded-2xl *:rounded-2xl',
                  place === 1 ? 'size-16' : 'size-14',
                  you || place === 1 ? 'ring-primary' : 'ring-border',
                )}
              />
            </span>
            {/* The reader by name like everyone else (Stay, 28 October 2026); the gold ring marks them. */}
            <span className="mt-2 w-full truncate px-1 text-sm font-semibold text-foreground">{entry.user.name}</span>
            {/* The campus alone for the Law School; a university wraps in small
                type and is never cut (Arthur, 28 October 2026). */}
            {entry.user.institution ? (
              <span className="w-full px-1 text-[10px] leading-tight text-balance break-words text-muted-foreground sm:text-[11px]">
                {podiumInstitution(entry.user.institution)}
              </span>
            ) : null}
            <span className="mt-0.5 font-comfortaa text-sm font-bold text-foreground tabular-nums">
              {scoreLabel(entry.points)}
              <span className="sr-only"> points</span>
            </span>
            <span aria-hidden className={cn('mt-3 h-3 w-full [clip-path:polygon(8%_0,92%_0,100%_100%,0_100%)]', block.top)} />
            <span
              aria-label={`Place ${entry.rank}`}
              className={cn(
                'flex w-full flex-col items-center bg-gradient-to-b to-transparent pt-2 font-comfortaa text-4xl leading-none font-bold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.18)]',
                block.front,
              )}
            >
              <span aria-hidden className="mb-1 flex gap-0.5">
                {[0, 1, 2].map((star) => (
                  <Star key={star} className="size-2 fill-white text-white" />
                ))}
              </span>
              {entry.rank}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One place under the podium: rank, face, name over where they study, points. */
function BoardRow({ entry, you, standing = null }: { entry: QuizLeaderboardEntry; you: boolean; standing?: string | null }) {
  return (
    <li className={cn('flex min-w-0 flex-col', you && 'rounded-xl border-transparent bg-primary/10 ring-2 ring-primary/50')}>
      <PlayerLine rank={entry.rank} user={entry.user} points={entry.points} you={you} />
      {standing ? <StandingNote>{standing}</StandingNote> : null}
    </li>
  );
}

/**
 * The reader's own place when it is below the ten. It reads like every other
 * row (Stay, 28 October 2026: "the bottom one should have my name like the
 * other users"): the server sends the reader as a row shows a player
 * (`viewer.user`, the same school rule); before it does, the session's name
 * and face stand in, with no school. Their standing sits under it, in the gold.
 */
function YourRow({ viewer, standing }: { viewer: NonNullable<QuizLeaderboard['viewer']>; standing: string | null }) {
  const session = useV2Session();
  const user = viewer.user ?? {
    uuid: session.userUuid ?? 'you',
    name: session.name ?? 'You',
    avatar_url: session.avatarUrl,
  };
  return (
    <li className="flex min-w-0 flex-col rounded-xl bg-primary/10 ring-2 ring-primary/50">
      <PlayerLine rank={viewer.rank} user={user} points={viewer.points} you />
      {standing ? <StandingNote>{standing}</StandingNote> : null}
    </li>
  );
}

/** Rank, face, name over where they study, and points. */
function PlayerLine({
  rank,
  user,
  points,
  you,
}: {
  rank: number;
  user: QuizLeaderboardEntry['user'];
  points: number;
  you: boolean;
}) {
  return (
    <div className="flex min-h-14 min-w-0 items-center gap-3 px-2 py-2">
      <span className="flex w-9 shrink-0 items-center gap-1 text-sm font-semibold text-foreground tabular-nums">
        <Trophy aria-hidden className={cn('size-3.5', you ? 'text-primary' : 'text-muted-foreground')} />
        <span className="sr-only">Place </span>
        {rank}
      </span>
      <MemberAvatar
        user={{ name: user.name, avatar_url: user.avatar_url ?? null }}
        className="size-10 rounded-xl after:rounded-xl *:rounded-xl"
      />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
          {you ? <YouPill /> : null}
        </span>
        {user.institution ? <span className="truncate text-xs text-muted-foreground">{user.institution}</span> : null}
      </span>
      <span className="shrink-0 font-comfortaa text-sm font-bold text-foreground tabular-nums">
        {scoreLabel(points)}
        <span className="sr-only"> points</span>
      </span>
    </div>
  );
}

/** The reader's standing, one short line under their row, inside the gold. */
function StandingNote({ children }: { children: string }) {
  return <p className="-mt-1 pr-2 pb-2.5 pl-[6.75rem] text-xs font-medium text-foreground/75">{children}</p>;
}

function YouPill() {
  return (
    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">You</span>
  );
}

/** The board's reserved shape while it is read. */
export function FrontBoardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-5 w-28 rounded" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:gap-6">
        <div className="mx-auto grid w-full grid-cols-3 items-end gap-1 pt-6 md:max-w-lg">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-2xl" style={{ opacity: 1 - index * 0.2 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
