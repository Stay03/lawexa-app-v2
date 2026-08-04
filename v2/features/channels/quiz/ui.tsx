'use client';

import type { ReactNode } from 'react';
import { Check, Crown, Minus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { QuizGamePlayer, QuizRankingRow } from '@/types/channel-quiz';
import type { SlimUser } from '@/types/collab';
import { MemberAvatar } from '../ui/avatars';
import { useServerCountdown } from './game-clock';
import { optionLetter } from './model';

/**
 * quiz game UI kit — the pieces every phase of the live game is built from.
 *
 * Phase-5 W6; sources: `docs/api/channel-quiz.md` (backend repo) and
 * `api-digest.md` §E. Design: design-research OWNER FEEL DIRECTIVE
 * ("Discord's fluidity, Linear's cleanliness, our gold") and its no-list —
 * gold does all the signalling, and the ONLY red in this feature is a wrong
 * answer at the reveal, paired with the emerald the app already uses for
 * "correct" (`quiz/results/ResultItemCard.tsx`'s token pair, matched here so a
 * reader who plays both quizzes reads one colour language).
 *
 * CLOCK LEAVES ARE SMALL ON PURPOSE. {@link QuestionTimer} and
 * {@link CountdownDial} are the only components that subscribe to the game
 * clock, so the five-times-a-second tick never re-renders an option grid, a
 * leaderboard or a question body.
 */

/* ── Layout ───────────────────────────────────────────────────────────────── */

/** The one column every phase body lives in — centred, capped, and scrollable
 *  on short viewports without the page ever moving under a tap. */
export function GameStage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div
        className={cn(
          'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A phase's quiet caption line — "Question 3 of 10", "Waiting for the host". */
export function StageKicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/* ── Clocks ───────────────────────────────────────────────────────────────── */

/**
 * The question timer: a draining gold bar plus the seconds left.
 *
 * DRIVEN BY THE TICK, NOT BY A KEYFRAME ANIMATION. The obvious implementation
 * — one CSS animation whose duration is the remaining time — cannot survive
 * this screen: the component re-renders five times a second for the digit, and
 * rewriting `animation-duration` on a running animation re-times it rather than
 * restarting it, so the bar visibly jumps. Instead the transform is set from
 * the clock on every tick with a linear transition exactly one tick long, so
 * the browser interpolates the gap and the motion is continuous — and a reader
 * who joins mid-question is drawn at their true remaining fraction from the
 * first frame, with no anchoring to get wrong.
 *
 * At zero it says so and WAITS: the server closes the question, never this
 * component (the ±1s tolerance is contractual).
 */
export function QuestionTimer({
  deadline,
  opensAt,
}: {
  deadline: string | null | undefined;
  opensAt: string | null | undefined;
}) {
  const clock = useServerCountdown(deadline, opensAt);
  const fraction = clock.fraction ?? 1;

  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full origin-left rounded-full bg-primary transition-transform duration-200 ease-linear motion-reduce:transition-none"
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
      <span
        role="timer"
        aria-live="off"
        className={cn(
          'w-12 shrink-0 text-right text-sm font-semibold tabular-nums',
          clock.expired ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {clock.expired ? '—' : `${clock.seconds}s`}
      </span>
    </div>
  );
}

/** The count-in dial: one big number, one pulse per second. */
export function CountdownDial({ deadline }: { deadline: string | null }) {
  const clock = useServerCountdown(deadline);
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div
        className={cn(
          'flex size-32 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/5',
          !clock.expired && 'v2-quiz-beat',
        )}
      >
        <span
          role="timer"
          aria-live="off"
          className="text-5xl font-semibold tabular-nums text-primary"
        >
          {/* The count-in has no phase length to fall back on, so the frame
              before the clock starts shows the ring and no number rather than
              a zero it is about to contradict. */}
          {!clock.ready ? null : clock.expired ? '0' : clock.seconds}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {clock.expired ? 'Starting…' : 'Get ready'}
      </p>
    </div>
  );
}

/* ── Options ──────────────────────────────────────────────────────────────── */

export type OptionState =
  | 'idle'
  | 'picked'
  | 'locked-other'
  | 'correct'
  | 'wrong-pick'
  | 'missed';

const OPTION_TONE: Record<OptionState, string> = {
  idle: 'border-border bg-card hover:border-primary/50 hover:bg-primary/5',
  picked: 'border-primary bg-primary/10',
  'locked-other': 'border-border bg-card opacity-55',
  correct: 'border-emerald-500/50 bg-emerald-500/10',
  'wrong-pick': 'border-destructive/50 bg-destructive/10',
  missed: 'border-border bg-card opacity-55',
};

/**
 * THE REVEAL IN WORDS (WCAG 1.4.1 — colour is never the only carrier).
 *
 * A revealed tile says everything visually through colour and a small icon:
 * emerald + tick for the answer, red + cross for a wrong pick, dimmed for the
 * rest. A reader who cannot see any of that gets the option's text and nothing
 * else, so each revealed tile carries one screen-reader-only sentence naming
 * its verdict. The pre-reveal states need none — `aria-pressed` already
 * announces the reader's own pick, and there is no verdict yet to withhold.
 */
const REVEAL_LABEL: Partial<Record<OptionState, string>> = {
  correct: 'Correct answer',
  'wrong-pick': 'Your answer — incorrect',
  missed: 'Not the answer',
};

const MARKER_TONE: Record<OptionState, string> = {
  idle: 'bg-secondary text-muted-foreground',
  picked: 'bg-primary text-primary-foreground',
  'locked-other': 'bg-secondary text-muted-foreground',
  correct: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  'wrong-pick': 'bg-destructive/20 text-destructive',
  missed: 'bg-secondary text-muted-foreground',
};

/**
 * One answer tile. A single element carries the whole life of an option —
 * offered, chosen, locked, judged — so nothing jumps position between phases
 * and the reader's eye stays where it was.
 *
 * `share` (0–1) draws the pick distribution INSIDE the tile at the reveal: a
 * quiet fill behind the text rather than a separate chart, so the answer and
 * how the room voted are one object.
 */
export function OptionTile({
  index,
  content,
  state,
  share,
  count,
  disabled,
  onSelect,
}: {
  index: number;
  content: string;
  state: OptionState;
  share?: number;
  count?: number;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const revealed = state === 'correct' || state === 'wrong-pick' || state === 'missed';
  const interactive = !!onSelect && !disabled;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!interactive}
      aria-pressed={state === 'picked' || state === 'wrong-pick' ? true : undefined}
      className={cn(
        'v2-interactive relative flex min-h-16 w-full items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 text-left',
        'transition-[color,background-color,border-color,opacity] duration-150 motion-reduce:transition-none',
        interactive && 'cursor-pointer active:scale-[0.99]',
        !interactive && 'cursor-default',
        OPTION_TONE[state],
      )}
    >
      {/* The room's picks, behind the text. */}
      {revealed && share !== undefined && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 left-0 transition-[width] duration-500 ease-out motion-reduce:transition-none',
            state === 'correct' ? 'bg-emerald-500/10' : 'bg-foreground/5',
          )}
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      )}

      <span
        aria-hidden
        className={cn(
          'relative flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
          MARKER_TONE[state],
        )}
      >
        {state === 'correct' ? (
          <Check className="size-4" />
        ) : state === 'wrong-pick' ? (
          <X className="size-4" />
        ) : (
          optionLetter(index)
        )}
      </span>

      <span className="relative min-w-0 flex-1 text-sm font-medium break-words text-foreground">
        {content}
        {REVEAL_LABEL[state] && (
          <span className="sr-only">. {REVEAL_LABEL[state]}</span>
        )}
      </span>

      {revealed && count !== undefined && (
        <span className="relative shrink-0 text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </button>
  );
}

/* ── People ───────────────────────────────────────────────────────────────── */

/** A lobby face: avatar over a truncated name, with the host crowned. */
export function PlayerChip({
  user,
  host,
}: {
  user: SlimUser;
  host?: boolean;
}) {
  return (
    <div className="flex w-20 flex-col items-center gap-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200">
      <div className="relative">
        <MemberAvatar user={user} />
        {host && (
          <span
            aria-hidden
            className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Crown className="size-2.5" />
          </span>
        )}
      </div>
      <span className="w-full truncate text-center text-xs text-muted-foreground">
        {user.name}
        {host && <span className="sr-only"> (host)</span>}
      </span>
    </div>
  );
}

/** A rank line — used live (leaderboard) and at the end (full ranking). */
export function RankRow({
  rank,
  user,
  score,
  detail,
  isViewer,
}: {
  rank: number;
  user: SlimUser;
  score: number;
  detail?: string;
  isViewer?: boolean;
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2',
        isViewer ? 'bg-primary/10' : 'odd:bg-secondary/40',
      )}
    >
      <span
        className={cn(
          'w-6 shrink-0 text-sm font-semibold tabular-nums',
          rank <= 3 ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {rank}
      </span>
      <MemberAvatar user={user} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {user.name}
          {isViewer && <span className="text-muted-foreground"> · you</span>}
        </span>
        {detail && (
          <span className="block truncate text-xs text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {score.toLocaleString()}
      </span>
    </li>
  );
}

/** The live leaderboard between questions (only when the game enables it). */
export function Leaderboard({
  players,
  viewerUuid,
  limit,
}: {
  players: readonly QuizGamePlayer[];
  viewerUuid: string | null;
  limit?: number;
}) {
  const top = limit ? players.slice(0, limit) : players;
  const viewerRow = players.find((player) => player.user.uuid === viewerUuid);
  const viewerOutside =
    viewerRow && !top.some((player) => player.user.uuid === viewerUuid);

  return (
    <ol className="flex flex-col gap-1">
      {top.map((player) => (
        <RankRow
          key={player.user.uuid}
          rank={player.rank}
          user={player.user}
          score={player.score}
          isViewer={player.user.uuid === viewerUuid}
        />
      ))}
      {viewerOutside && viewerRow && (
        <>
          <li aria-hidden className="flex justify-center py-0.5 text-muted-foreground">
            <Minus className="size-3" />
          </li>
          <RankRow
            rank={viewerRow.rank}
            user={viewerRow.user}
            score={viewerRow.score}
            isViewer
          />
        </>
      )}
    </ol>
  );
}

/** Ranking detail line: "8 of 10 right" — and, for a late joiner, out of how
 *  many they could actually answer (the contract's `answerable_count`). */
export function rankingDetail(row: QuizRankingRow): string {
  const base = `${row.correct_count} of ${row.answerable_count} right`;
  // `answerable_count < question_count` IS the late-join marker (contract), and
  // `joined_at_question_index` names the moment — either one alone would leave
  // a smaller denominator looking like a mistake.
  return row.joined_at_question_index !== null ? `${base} · joined late` : base;
}

/* ── Loading ──────────────────────────────────────────────────────────────── */

/** The game's first-load shape: a kicker, a question block, four tiles. */
export function GameStageSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-2xl px-4 py-6">
      <Skeleton className="h-3 w-24 rounded" />
      <Skeleton className="mt-4 h-6 w-3/4 rounded" />
      <Skeleton className="mt-2 h-6 w-1/2 rounded" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton
            key={index}
            className="h-16 rounded-xl"
            style={{ opacity: Math.max(0.3, 1 - index * 0.18) }}
          />
        ))}
      </div>
    </div>
  );
}
