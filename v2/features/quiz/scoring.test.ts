import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QuizAttempt, QuizAttemptQuestion } from '@/types/channel-quiz';
import { countsTowardScore, scoringLabel } from './scoring';
import { attemptScore } from './solo/model';
import { answersScore } from './solo/results/answers-model';

/* Quiz question kinds (Arthur, 26 October 2026; thread a2f9567d): a question
 * is scored, unscored ("Bonus": answered, no points, left out of the total)
 * or free_point ("Free point": any answer is right). The app labels the kind
 * and counts only what the server counts. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const code = (...parts: string[]) =>
  read(...parts).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const question = (overrides: Partial<QuizAttemptQuestion>): QuizAttemptQuestion => ({
  uuid: 'q',
  type: 'multiple_choice',
  question: 'TEST DATA question',
  time_limit_seconds: 30,
  position: 0,
  options: [],
  answered: true,
  your_option_id: 1,
  ...overrides,
});

test('a question says Bonus or Free point, and nothing when it is scored the usual way', () => {
  assert.equal(scoringLabel({ scoring: 'unscored' }), 'Bonus');
  assert.equal(scoringLabel({ scoring: 'free_point' }), 'Free point');
  assert.equal(scoringLabel({ scoring: 'scored' }), null);
  // A body from before the field counts as scored.
  assert.equal(scoringLabel({}), null);
  assert.equal(countsTowardScore({}), true);
  assert.equal(countsTowardScore({ scoring: 'free_point' }), true);
  assert.equal(countsTowardScore({ scoring: 'unscored' }), false);
});

test('a finished attempt’s "x of y right" is over the questions that count', () => {
  const attempt = {
    finished_at: '2026-10-26T18:00:00Z',
    question_count: 10,
    scored_count: 8,
    answered_count: 10,
    correct_count: 6,
    score_percent: 75,
    points: 5200,
    max_points: 8000,
  } as unknown as QuizAttempt;
  assert.equal(attemptScore(attempt)?.total, 8);
  // Before the field, every question counted.
  const older = { ...attempt, scored_count: undefined } as unknown as QuizAttempt;
  assert.equal(attemptScore(older)?.total, 10);
});

test('the answers page leaves a Bonus question out of its score, not out of its pages', () => {
  const score = answersScore([
    question({ uuid: 'a', is_correct: true }),
    question({ uuid: 'b', is_correct: false }),
    question({ uuid: 'c', is_correct: true, scoring: 'unscored' }),
    question({ uuid: 'd', is_correct: true, scoring: 'free_point' }),
  ]);
  assert.deepEqual(score, { right: 2, counted: 3 });
  const stepper = code('v2', 'features', 'quiz', 'solo', 'results', 'AnswersStepper.tsx');
  assert.match(stepper, /\{score\.right\} of \{score\.counted\} right/);
});

test('the label shows where a question is asked and reviewed', () => {
  assert.match(code('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx'), /<ScoringBadge question=\{question\} className="mt-2\.5" \/>\s*<h1/);
  assert.match(code('v2', 'features', 'quiz', 'solo', 'results', 'AnswersStepper.tsx'), /<\/span>\s*<ScoringBadge question=\{question\} \/>/);
  const game = code('v2', 'features', 'channels', 'quiz', 'GamePhases.tsx');
  assert.match(game, /<ScoringBadge question=\{current\.question\} \/>/);
  assert.match(game, /<StageKicker>Last question<\/StageKicker>\s*<ScoringBadge question=\{question\} \/>/);
  // A quiz card inside a chat answer is left as it is (techlead, 26 October 2026).
  assert.doesNotMatch(code('v2', 'features', 'conversations', 'conversation', 'cards', 'QuizCard.tsx'), /ScoringBadge|scoring/);
});

test('a 409 on saving a quiz freezes its questions only when they were played', async () => {
  const { quizSaveConflict } = await import('@/v2/features/channels/quiz/form-model');
  assert.equal(quizSaveConflict('questions_played'), 'frozen');
  assert.equal(quizSaveConflict('quiz_live'), 'temporary');
  assert.equal(quizSaveConflict('question_in_use'), 'temporary');
  // No reason: never read as a freeze.
  assert.equal(quizSaveConflict(undefined), 'temporary');
  const dialog = code('v2', 'features', 'channels', 'quiz', 'QuizFormDialog.tsx');
  assert.match(dialog, /if \(status === 409 && !metadataOnly && quizSaveConflict\(reason\) === 'frozen'\) \{\s*setFrozen\(true\);/);
  // A passing 409 falls through to the server's sentence, with the form and its edits kept.
  assert.match(dialog, /setError\(message\);/);
});
