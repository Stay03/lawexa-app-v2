/**
 * answers-model — the pure half of "See your answers", one question per page
 * (Stay, 23 October 2026, 00:03Z: "Why not one question per page. We already
 * have a quiz question review page right can you take inspiration from
 * that?"; Arthur, 00:16Z: "one per page is better. go with stay").
 *
 * The practice review's stepper (`v2/features/quiz/results/ReviewStepper`) in
 * the attempt's shape: a filter (All, Wrong, Right), the deck of questions it
 * leaves, a step through that deck, and the 1-based `?q=` the page keeps in
 * its address. No DOM here, so every rule is pinned by a test.
 */

import type { QuizAttemptQuestion } from '@/types/channel-quiz';
import { questionVerdict } from '../model';
import { countsTowardScore } from '../../scoring';

export type AnswersFilter = 'all' | 'wrong' | 'right';

/** Past this many questions a review that opens on question one wastes the
 *  reader's time, so it opens on the first one to look at again instead (the
 *  practice review's rule and number). */
export const OPEN_ON_WRONG_ABOVE = 20;

/** A skipped question counts with the wrong ones: the score counts it as
 *  wrong, and it is one to look at again (`toReviewCount`). */
export function matchesAnswersFilter(question: QuizAttemptQuestion, filter: AnswersFilter): boolean {
  if (filter === 'all') return true;
  const right = questionVerdict(question) === 'correct';
  return filter === 'right' ? right : !right;
}

/** How many questions each filter keeps, for its pill. */
export function answersCounts(questions: readonly QuizAttemptQuestion[]): Record<AnswersFilter, number> {
  const right = questions.filter((question) => questionVerdict(question) === 'correct').length;
  return { all: questions.length, wrong: questions.length - right, right };
}

/**
 * "x of y right" over the questions that count (Arthur, 26 October 2026): a
 * Bonus question is reviewed and filtered like any other, but it is left out
 * of the score, as the server leaves it out of `correct_count`.
 */
export function answersScore(questions: readonly QuizAttemptQuestion[]): { right: number; counted: number } {
  const counted = questions.filter(countsTowardScore);
  return { right: counted.filter((question) => questionVerdict(question) === 'correct').length, counted: counted.length };
}

/** The 0-based positions a filter keeps, in the quiz's order. */
export function answersDeck(questions: readonly QuizAttemptQuestion[], filter: AnswersFilter): number[] {
  const deck: number[] = [];
  questions.forEach((question, index) => {
    if (matchesAnswersFilter(question, filter)) deck.push(index);
  });
  return deck;
}

/** `?q=` (1-based, human-facing) to a 0-based position, or `null` when it is
 *  absent, not a whole number, or outside the quiz. */
export function parseAnswerIndex(raw: string | null | undefined, total: number): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > total) return null;
  return parsed - 1;
}

/** Where the review opens: the question a link names (under All, so it is in
 *  the deck), else the first wrong one on a long quiz, else question one. */
export function openingAnswer(
  questions: readonly QuizAttemptQuestion[],
  rawQ: string | null | undefined,
): { filter: AnswersFilter; index: number } {
  const fromUrl = parseAnswerIndex(rawQ, questions.length);
  if (fromUrl !== null) return { filter: 'all', index: fromUrl };
  if (questions.length > OPEN_ON_WRONG_ABOVE) {
    const firstWrong = questions.findIndex((question) => matchesAnswersFilter(question, 'wrong'));
    if (firstWrong !== -1) return { filter: 'wrong', index: firstWrong };
  }
  return { filter: 'all', index: 0 };
}

/** The next or previous position in the deck, or `null` at its end. */
export function stepAnswer(deck: readonly number[], current: number, towards: 'next' | 'prev'): number | null {
  const position = deck.indexOf(current);
  const next = towards === 'next' ? position + 1 : position - 1;
  return next >= 0 && next < deck.length ? deck[next] : null;
}

/** After a filter change: stay on the open question when the new filter keeps
 *  it, else the first question the new filter keeps; `null` for an empty deck. */
export function indexAfterFilter(
  questions: readonly QuizAttemptQuestion[],
  current: number,
  filter: AnswersFilter,
): number | null {
  const question = questions[current];
  if (question && matchesAnswersFilter(question, filter)) return current;
  const first = questions.findIndex((entry) => matchesAnswersFilter(entry, filter));
  return first === -1 ? null : first;
}

/** "3 of 20", or "2 of 5 wrong" under a filter. */
export function answersPositionLabel(deck: readonly number[], current: number, filter: AnswersFilter): string {
  const position = deck.indexOf(current);
  const shown = position === -1 ? 0 : position + 1;
  return `${shown} of ${deck.length}${filter === 'all' ? '' : ` ${filter}`}`;
}

/** The review's own page, a child of the attempt. */
export function attemptAnswersHref(attemptUuid: string): string {
  return `/quiz/attempts/${attemptUuid}/answers`;
}
