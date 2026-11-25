import type { QuizAttempt, QuizScoreToBeat } from '@/types/channel-quiz';
import { pointsLabel } from './model';

/**
 * retake-model — public quizzes as competitions (Arthur, 25 November 2026,
 * thread ab1802fe). A player's FIRST finished attempt sets their score and
 * place on the board. Retakes are unlimited and are practice: they never move
 * the board. The "Score to Beat" is the highest score anyone has reached, on
 * any attempt, and who reached it first (a tie does not take it).
 *
 * Every fact here is the server's: whether an attempt is the board one
 * (`is_board_attempt`), the board score beside a practice score
 * (`board_points`), and whether the attempt holds the Score to Beat now
 * (`holds_score_to_beat`). An older server sends none of these, and the
 * screens then say what they said before.
 */

export const START_LABEL = 'Start quiz';
export const RETAKE_LABEL = 'Retake quiz';

/** The quiz page's button: "Retake quiz" once the reader has finished an attempt. */
export function startLabel(finishedAttempts: number | null | undefined): string {
  return typeof finishedAttempts === 'number' && finishedAttempts > 0 ? RETAKE_LABEL : START_LABEL;
}

/** The Score to Beat as a board's head shows it, or `null` before anyone has finished. */
export interface ScoreToBeatView {
  points: string;
  /** The holder's name, or "You" when it is the reader. */
  holder: string;
  you: boolean;
  avatarUrl: string | null;
}

export function scoreToBeatView(
  scoreToBeat: QuizScoreToBeat | null | undefined,
  viewerUuid: string | null | undefined,
): ScoreToBeatView | null {
  if (!scoreToBeat) return null;
  const you = Boolean(viewerUuid) && scoreToBeat.user.uuid === viewerUuid;
  return {
    points: pointsLabel(scoreToBeat.points),
    holder: you ? 'You' : scoreToBeat.user.name.trim() || 'A player',
    you,
    avatarUrl: scoreToBeat.user.avatar_url,
  };
}

/**
 * What a finished attempt is, for the results:
 *  - `board`: the attempt the board shows (the first), or any attempt on an
 *    older server. The results say the place as before.
 *  - `practice`: a retake. The score is marked as practice, with the board
 *    score that stays.
 *  - `none`: an attempt that cannot count (the author's, an unlisted quiz).
 * `holdsScoreToBeat` is said on both a board attempt and a retake.
 */
export type RunKind =
  | { kind: 'board'; holdsScoreToBeat: boolean }
  | { kind: 'practice'; holdsScoreToBeat: boolean; line: string }
  | { kind: 'none' };

export function runKind(
  attempt: Pick<QuizAttempt, 'is_board_attempt' | 'attempt_number' | 'board_points' | 'holds_score_to_beat'>,
): RunKind {
  const holds = attempt.holds_score_to_beat === true;
  if (attempt.is_board_attempt === undefined) return { kind: 'board', holdsScoreToBeat: holds };
  if (attempt.attempt_number === null) return { kind: 'none' };
  if (attempt.is_board_attempt) return { kind: 'board', holdsScoreToBeat: holds };
  const stays =
    typeof attempt.board_points === 'number' ? `Your board score stays ${pointsLabel(attempt.board_points)}.` : 'Your board score stays as it is.';
  return { kind: 'practice', holdsScoreToBeat: holds, line: `Practice run. ${stays}` };
}

/** The label under the points: "practice points" on a retake. */
export function pointsCaption(run: RunKind): string {
  return run.kind === 'practice' ? 'practice points' : 'points';
}

/** The words of the Score to Beat mark on the results. */
export const HOLDER_MARK = 'You hold the Score to Beat';
