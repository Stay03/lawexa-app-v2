import type { QuizQuestionScoring } from '@/types/channel-quiz';

/**
 * scoring — how a quiz question counts (Arthur, 26 October 2026; thread
 * a2f9567d): most questions are scored; an `unscored` one is shown and
 * answered but earns nothing and is left out of the total, so the reader is
 * told it is a "Bonus"; a `free_point` one counts as right whatever the
 * answer, so it says "Free point". The server does the scoring; the app says
 * which kind a question is, and counts only what the server counts.
 *
 * Pure, so the test can run it; `ScoringBadge` draws the label.
 */

export const SCORING_LABEL: Readonly<Record<Exclude<QuizQuestionScoring, 'scored'>, string>> = {
  unscored: 'Bonus',
  free_point: 'Free point',
};

/** The label a question carries, or `null` for an ordinary scored one. */
export function scoringLabel(question: { scoring?: QuizQuestionScoring }): string | null {
  const scoring = question.scoring ?? 'scored';
  return scoring === 'scored' ? null : SCORING_LABEL[scoring];
}

/** Whether the question counts toward the score: everything but `unscored`. */
export function countsTowardScore(question: { scoring?: QuizQuestionScoring }): boolean {
  return question.scoring !== 'unscored';
}
