'use client';

import type { ReactNode } from 'react';
import { Check, Crown, Minus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  QuizAnswerIn,
  QuizGamePlayer,
  QuizRankingRow,
} from '@/types/channel-quiz';
import type { SlimUser } from '@/types/collab';
import { MemberAvatar } from '../ui/avatars';
import { useServerCountdown } from './game-clock';
import {
  ANSWERS_RAIL_VISIBLE,
  CATCH_UP_AFTER_MS,
  formatResponseTime,
  NEXT_QUESTION_CAP_MS,
  optionLetter,
} from './model';

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
 * CLOCK LEAVES ARE SMALL ON PURPOSE. {@link QuestionTimer},
 * {@link NextQuestionCountdown} and {@link CountdownDial} are the only
 * components that subscribe to the game clock — one per phase, each a single
 * row — so the five-times-a-second tick never re-renders an option grid, a
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
 * The one fixed-height row under a question's kicker.
 *
 * EVERY PHASE OF A QUESTION USES IT — the draining timer, the "answer revealed,
 * next question in 3s" line, the waiting note — so the question body below can
 * never move when one replaces another. The rail is the whole reason the
 * question⇄reveal transition reads as one object changing state instead of two
 * screens swapping.
 */
export function PhaseRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-6 items-center gap-3', className)}>{children}</div>
  );
}

/**
 * A phase's quiet waiting word. Keyed by its own text so a change fades rather
 * than switching under the reader's eye.
 */
function WaitingWord({ children }: { children: string }) {
  return (
    <span
      key={children}
      className="shrink-0 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      {children}
    </span>
  );
}

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
 * AT ZERO IT SAYS SO AND WAITS. The server closes a question, never this
 * component. Two words cover the wait, and the difference between them is real:
 * "Time's up" is the ordinary ±1s handover, and after
 * {@link CATCH_UP_AFTER_MS} — around the point the server's own watchdog starts
 * acting on an overdue question — it becomes "Catching up", which is exactly
 * what the polling behind this screen is then doing.
 */
export function QuestionTimer({
  deadline,
  opensAt,
}: {
  deadline: string | null | undefined;
  opensAt: string | null | undefined;
}) {
  const clock = useServerCountdown(deadline, opensAt);
  const fraction = clock.expired ? 0 : (clock.fraction ?? 1);

  return (
    <PhaseRow>
      {/* The rail stays even when it is empty: at the deadline the bar drains
          to nothing and the word beside it changes, so the row never rebuilds
          itself under the reader. */}
      <div
        aria-hidden
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full origin-left rounded-full bg-primary transition-transform duration-200 ease-linear motion-reduce:transition-none"
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
      {clock.expired ? (
        <WaitingWord>
          {clock.overdueMs >= CATCH_UP_AFTER_MS ? 'Catching up…' : "Time's up"}
        </WaitingWord>
      ) : (
        <span
          role="timer"
          aria-live="off"
          className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground"
        >
          {clock.seconds}s
        </span>
      )}
    </PhaseRow>
  );
}

/**
 * The reveal's own line: what just happened, and when the next thing happens.
 *
 * THE COUNTDOWN IS A DIGIT, NOT A BAR, and that is a truth constraint rather
 * than a taste one. `next_opens_at` names when the next question opens, but
 * nothing names when the reveal STARTED — a question can close the instant its
 * last answer lands, so the gap has no published length to draw a bar against.
 * A digit needs only the end; a bar would need a beginning we would have to
 * invent.
 *
 * IT IS ALSO THE ONE CLOCK HERE WITH NO SAME-CLOCK DURATION TO CLAMP AGAINST,
 * which is why it passes an explicit cap ({@link NEXT_QUESTION_CAP_MS}): a
 * device whose wall clock runs a minute behind the server would otherwise
 * print "next question in 65s" for a five-second gap. The cap bounds the
 * device's error; it does not pretend to correct it.
 *
 * THE FINAL QUESTION HAS NO NEXT ONE, so it says so instead of counting to a
 * moment the server never named — which is also the screen's promise that the
 * podium is coming rather than a jump the reader has to interpret.
 */
export function NextQuestionCountdown({
  opensAt,
  isFinal,
}: {
  opensAt: string | null;
  isFinal: boolean;
}) {
  const clock = useServerCountdown(opensAt, null, NEXT_QUESTION_CAP_MS);

  return (
    <PhaseRow>
      <Check
        aria-hidden
        className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
      />
      <span className="text-sm text-muted-foreground">Answer revealed</span>
      {isFinal ? (
        <WaitingWord>final scores next</WaitingWord>
      ) : // No stamp, or the clock has not started yet (the SSR frame and the
      // one before the store's first subscriber): say nothing rather than a
      // zero the next tick contradicts.
      clock.idle || !clock.ready ? null : clock.expired ? (
        <WaitingWord>
          {clock.overdueMs >= CATCH_UP_AFTER_MS
            ? 'catching up…'
            : 'next question…'}
        </WaitingWord>
      ) : (
        <span
          role="timer"
          aria-live="off"
          className="text-sm text-muted-foreground"
        >
          next question in{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {clock.seconds}s
          </span>
        </span>
      )}
    </PhaseRow>
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
      {/* Past zero the count-in says what it is doing, and says it twice over:
          the ordinary handover first, then — if the first question is really
          late — the same word the question timer uses, because the polling
          behind this screen is what unfreezes a stalled count-in. */}
      {clock.expired ? (
        <WaitingWord>
          {clock.overdueMs >= CATCH_UP_AFTER_MS ? 'Catching up…' : 'Starting…'}
        </WaitingWord>
      ) : (
        <p className="text-sm text-muted-foreground">Get ready</p>
      )}
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

/**
 * THE ANSWERING RAIL — who is already in, and how fast, while the question is
 * still on screen. `current_question.answers_in` is arrival-ordered and lands
 * on the ordinary state read, so this works over polling alone and adds no
 * second beat of its own.
 *
 * FOUR RULES SHAPED IT, all of them the difference between a live room and a
 * scoreboard:
 *
 *  1. **It cannot leak the game.** The list names WHO and HOW FAST and nothing
 *     else — the payload has no pick and no correctness in it, in either phase,
 *     so there is nothing here to leak even by accident.
 *  2. **It cannot shame anyone.** It shows arrivals only. Nobody is ever named
 *     as missing, no fraction implies who is late, and the times are stated,
 *     never ranked.
 *  3. **It cannot move the question.** The rail is a FIXED height in every
 *     state, including empty, so the option grid above it never shifts as
 *     answers land — and it stays through the reveal for the same reason,
 *     because a rail that vanished at the reveal would throw the whole screen
 *     down by its own height at the worst moment.
 *  4. **It has to survive a crowd.** Newest first behind a leading "+N" fold
 *     mark past {@link ANSWERS_RAIL_VISIBLE}, with the row's tail fading out
 *     rather than being cut — so on any width, the two things worth seeing (how
 *     many are in, and who just landed) are the two things that stay.
 *
 * NOT A LIVE REGION (the house rule for this mode, and the reason the overlay
 * keeps exactly one announcer): a busy room would otherwise talk over a
 * screen-reader user for the whole question.
 */
export function AnswersInRail({
  answers,
}: {
  answers: readonly QuizAnswerIn[];
}) {
  const folded = Math.max(0, answers.length - ANSWERS_RAIL_VISIBLE);
  // Newest first: the arrival that just happened is always the one in view.
  const visible = answers.slice(folded).reverse();

  return (
    <section aria-label="Answers in" className="flex h-18 flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">
        {answers.length === 0
          ? 'Waiting for the first answer'
          : `${answers.length} answered`}
      </p>
      <ul
        className={cn(
          'flex min-h-0 flex-1 items-start gap-2 overflow-hidden',
          // The tail FADES instead of being cut: on a narrow screen the rail
          // runs out of room, and a half-sliced face reads as a bug where a
          // fade reads as "there is more".
          '[mask-image:linear-gradient(to_right,black_85%,transparent)]',
        )}
      >
        {/* THE FOLD MARK LEADS, and that is the whole point of it: it is the
            crowd affordance, so it must be the one thing a narrow phone cannot
            lose. Put last it would sit under the mask's transparent tail at
            exactly the room size that makes it worth showing. */}
        {folded > 0 && (
          <li className="flex w-10 shrink-0 flex-col items-center gap-1">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-medium text-muted-foreground"
            >
              +{folded}
            </span>
            <span className="sr-only">
              and {folded} more {folded === 1 ? 'answer' : 'answers'}
            </span>
          </li>
        )}
        {visible.map((entry) => (
          <AnswerChip key={entry.user.uuid} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

/** One arrival: a face, and the time it took. The name rides the tooltip and
 *  the screen-reader sentence — at this size a face IS the identity, and a
 *  truncated word under every avatar would read as noise. */
function AnswerChip({ entry }: { entry: QuizAnswerIn }) {
  const time = formatResponseTime(entry.response_ms);
  return (
    <li
      title={`${entry.user.name} · ${time}`}
      className="flex w-10 shrink-0 flex-col items-center gap-1 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200"
    >
      <MemberAvatar user={entry.user} />
      <span
        aria-hidden
        className="w-full truncate text-center text-[10px] tabular-nums text-muted-foreground"
      >
        {time}
      </span>
      <span className="sr-only">
        {entry.user.name} answered in {time}
      </span>
    </li>
  );
}

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

/** The game's first-load shape, at the geometry the real thing occupies: a
 *  kicker, the phase rail, a question block, four tiles, the answering rail. */
export function GameStageSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-2xl px-4 py-6">
      <Skeleton className="h-3 w-24 rounded" />
      <PhaseRow className="mt-3">
        <Skeleton className="h-1.5 flex-1 rounded-full" />
        <Skeleton className="h-3 w-8 rounded" />
      </PhaseRow>
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
      <div className="mt-6 flex h-18 flex-col gap-1.5">
        <Skeleton className="h-3 w-28 rounded" />
        <div className="flex items-start gap-2">
          {[0, 1, 2].map((index) => (
            <Skeleton
              key={index}
              className="size-8 rounded-full"
              style={{ opacity: Math.max(0.3, 1 - index * 0.25) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
