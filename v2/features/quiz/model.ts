import { extractApiError } from '@/lib/utils/api-error';
import {
  formatDurationMs,
  formatScorePercent,
  formatSessionDate,
  sessionDurationMs,
} from '@/lib/utils/quiz-format';
import type {
  QuizDifficulty,
  QuizResultItem,
  QuizSession,
  QuizSessionStatus,
  QuizStatsData,
} from '@/types/quiz';
import type { V2SessionSnapshot } from '@/v2/runtime/session-context';

/**
 * model.ts — the pure presentation vocabulary of the quiz feature: status
 * labels, the honest reading of the stats payload, the session meta line, and
 * the two lifecycle-error predicates every screen branches on. No JSX, no
 * hooks — importable from any quiz component so the hub row, the history row
 * and the results header can never disagree.
 *
 * It sits ON TOP of `lib/utils/quiz-format.ts` (pure, shared with v1, and
 * therefore importable): that module owns the decimal-string parsing and the
 * duration/date grammar; this one owns everything v2-specific.
 *
 * TIME IS ALWAYS THREADED IN where a relative label is involved — the caller
 * passes `now` from a lazy `useState(() => Date.now())`, never the clock read
 * in render (React Compiler lint).
 */

/* ── Lifecycle vocabulary ───────────────────────────────────────────────── */

/**
 * Session status → label + dot colour, mirroring `RADAR_STATUS`'s house
 * grammar. The label ALWAYS renders beside the dot — status is never
 * colour-only. `active` wears the brand gold because it is the one status the
 * reader can act on (resume); the other two are outcomes, not invitations.
 */
export const QUIZ_SESSION_STATUS: Record<
  QuizSessionStatus,
  { label: string; dotClass: string }
> = {
  active: { label: 'In progress', dotClass: 'bg-primary' },
  completed: { label: 'Completed', dotClass: 'bg-emerald-500' },
  abandoned: { label: 'Abandoned', dotClass: 'bg-muted-foreground/50' },
};

/** Whether a session can still be played (the only status with a Resume path). */
export function isResumable(session: QuizSession): boolean {
  return session.status === 'active';
}

/** Where a session row leads: back into play, or into its finalized review. */
export function sessionHref(session: QuizSession): string {
  return isResumable(session)
    ? `/quiz/${session.uuid}`
    : `/quiz/${session.uuid}/results`;
}

/**
 * The meta line under a session row, in the v2 row grammar's TWO ZONES.
 *
 * `lead`  what the attempt did — the counts. Left-aligned under the status
 *         dot, which is fixed-width and therefore already aligned.
 * `trail` WHEN it happened, and how long it took. Right-anchored, so the dates
 *         read straight down the list instead of starting wherever the counts
 *         happened to stop ("3 of 10 correct" and "12 of 20 correct" are not
 *         the same width, and the date used to move with them).
 *
 * One builder for the hub's recent list and the history page, so the two can
 * never drift.
 *
 * An ACTIVE session shows what it has answered so far and nothing about score:
 * the score of a session still in progress is a moving number, and putting it
 * beside a "Resume" affordance reads as a verdict on an unfinished attempt.
 */
export interface SessionMetaZones {
  lead: string;
  /** Date first, then the wall-clock duration when there is one. */
  trail: string[];
}

export function sessionMetaZones(session: QuizSession): SessionMetaZones {
  const lead = isResumable(session)
    ? session.answered_count === 1
      ? '1 answered'
      : `${session.answered_count} answered`
    : `${session.correct_count} of ${session.answered_count} correct`;

  const trail: string[] = [
    formatSessionDate(session.completed_at ?? session.started_at),
  ];

  const duration = sessionDurationMs(session.started_at, session.completed_at);
  if (duration !== null) trail.push(formatDurationMs(duration));

  return { lead, trail };
}

/**
 * The score a FINISHED session row shows, or `null` when there is nothing
 * honest to show — an active session (moving target) or one that answered
 * nothing at all (a "0%" for zero questions is a lie about performance).
 */
export function finalScoreLabel(session: QuizSession): string | null {
  if (isResumable(session) || session.answered_count === 0) return null;
  return formatScorePercent(session.score_percentage);
}

/* ── Difficulty ─────────────────────────────────────────────────────────── */

/** Difficulty is an ORDERED scale, so it is encoded as a filled-step meter
 *  (1–5) beside its word — never as a good/bad colour. */
export const DIFFICULTY_STEPS = 5;

/** The five ordinal steps, for the badge's meter. */
export const DIFFICULTY_SCALE: readonly number[] = [1, 2, 3, 4, 5];

/** Accessible sentence for a difficulty badge ("Easy — level 2 of 5"). */
export function difficultyDescription(
  difficulty: QuizDifficulty,
  label: string,
): string {
  return `${label} — level ${difficulty} of ${DIFFICULTY_STEPS}`;
}

/* ── Lifecycle errors ───────────────────────────────────────────────────── */

/** The HTTP status behind an unknown error, or `0` when it never reached the
 *  API (network failure). */
export function errorStatus(error: unknown): number {
  return error ? extractApiError(error).status : 0;
}

/**
 * A 403 from any `/quizzes/*` endpoint means exactly one thing: the backend
 * has not verified this account's email. It is the ONE server-side gate on the
 * player (the researcher/admin soft-launch gate is ours, and the backend does
 * not enforce it — verified live, 2026-08-03), so a 403 is never "forbidden",
 * it is "verify your email".
 */
export function isVerificationBlocked(error: unknown): boolean {
  return errorStatus(error) === 403;
}

/**
 * Whether THIS viewer's snapshot already says they will be blocked — so a
 * screen can render the verify-email panel on the first frame instead of
 * waiting for a 403 to come back.
 *
 * THREE CONDITIONS, EACH LOAD-BEARING:
 *  - signed in — a signed-out viewer has no address to verify;
 *  - NOT a guest — a guest account has no email at all (`email: null`), and the
 *    backend proves it treats them differently: a guest token played a full
 *    session while an unverified REGISTERED account 403'd on every endpoint
 *    (verified live, 2026-08-03). Without this clause a guest matches on
 *    `authProvider === 'email'` + `isVerified === false` and would be told to
 *    check an inbox they do not have. Today the audience gate blocks guests
 *    first so it never surfaces — which is exactly why it is worth encoding the
 *    REAL rule now: the day the audience widens, the masked bug ships.
 *  - `email` provider — an OAuth account arrives verified, so gating on
 *    `isVerified` alone would nag every Google user.
 *
 * A stale snapshot is still covered in the other direction: a real 403 lands on
 * the same panel via {@link isVerificationBlocked}.
 */
export function needsEmailVerification(session: V2SessionSnapshot): boolean {
  return (
    session.signedIn &&
    session.role !== 'guest' &&
    session.authProvider === 'email' &&
    !session.isVerified
  );
}

/* ── Stats: the zero-vs-null fix ────────────────────────────────────────── */

/**
 * A metric that may honestly have no value yet. `null` means "nothing to
 * average" and MUST render as an em dash, never as `0`.
 */
export type MaybeMetric = number | null;

export interface HonestStats {
  /** Mean finalized session score (%), or `null` when nothing has completed. */
  avgScore: MaybeMetric;
  /** correct ÷ answered (%), or `null` when nothing has been answered. */
  accuracy: MaybeMetric;
  /** Mean think-time per answered question (ms), or `null` when none. */
  avgTimeMs: MaybeMetric;
  /** completed ÷ (completed + abandoned) (%), or `null` when neither. */
  completionRate: MaybeMetric;
  /** True when this account has no quiz history at all. */
  isEmpty: boolean;
}

/**
 * Read the stats payload HONESTLY.
 *
 * THE BUG THIS FIXES (verified live, 2026-08-03, on an account with nothing
 * played): the backend returns `avg_score: 0` and
 * `avg_time_per_question_ms: 0` rather than `null`, so a brand-new user was
 * told they average 0% and 0s per question. Only `accuracy` and
 * `completion_rate` actually arrive as `null`.
 *
 * The disambiguation is DERIVED FROM THE COUNTS that produced each mean, never
 * from the value itself:
 *
 *   avg_score                 honest only when a session has COMPLETED
 *   avg_time_per_question_ms  honest only when a question has been ANSWERED
 *   accuracy                  honest only when a question has been ANSWERED
 *   completion_rate           honest only when a session has ENDED either way
 *
 * So a genuine 0% average — a user who really did complete sessions and score
 * nothing — still renders "0%". That is the whole point of deriving it: the
 * fix must not swallow a real zero.
 */
export function readStats(data: QuizStatsData): HonestStats {
  const { sessions, performance, engagement } = data;
  const hasCompleted = engagement.completed > 0;
  const hasAnswered = sessions.answered > 0;
  const hasEnded = engagement.completed + engagement.auto_abandoned > 0;

  return {
    avgScore: hasCompleted ? performance.avg_score : null,
    accuracy: hasAnswered ? performance.accuracy : null,
    avgTimeMs: hasAnswered ? performance.avg_time_per_question_ms : null,
    completionRate: hasEnded ? engagement.completion_rate : null,
    isEmpty: sessions.total === 0,
  };
}

/** Render a percentage metric, or the em dash that means "no data yet". */
export function metricPercent(value: MaybeMetric): string {
  return value == null ? '—' : `${Math.round(value)}%`;
}

/** Render a duration metric, or the em dash that means "no data yet". */
export function metricDuration(value: MaybeMetric): string {
  return value == null ? '—' : formatDurationMs(value);
}

/* ── Results ────────────────────────────────────────────────────────────── */

/** Mean answer time across a finished session, or `null` when it answered
 *  nothing — the same zero-vs-null discipline the stats page applies. */
export function meanAnswerTimeMs(items: QuizResultItem[]): number | null {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + (item.time_spent_ms || 0), 0);
  return total > 0 ? total / items.length : null;
}
