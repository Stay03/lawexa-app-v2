import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { challengeFromParam } from './front/front-model';
import { challengeBanner, quizChallengeHref } from './model';

/* Challenge a Friend, the link and the banner (Arthur, 10 November 2026;
 * Backend's shapes 7a007a8c). The link carries the challenger's finished
 * attempt; the friend's quiz page shows the score to beat, and their attempt
 * names it, so the challenger is told how they did. TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const ATTEMPT = '0b5e1c2a-7d3f-4a10-9c11-2f6b8e4d1a77';

test('a challenge link is the quiz front carrying the finished attempt', () => {
  assert.equal(quizChallengeHref('quiz-1', ATTEMPT), `/quiz/q/quiz-1?from=${ATTEMPT}`);
});

test('only a uuid in ?from= counts; anything else reads no banner and sends no from', () => {
  assert.equal(challengeFromParam(ATTEMPT), ATTEMPT);
  assert.equal(challengeFromParam(ATTEMPT.toUpperCase()), ATTEMPT.toUpperCase());
  assert.equal(challengeFromParam(null), null);
  assert.equal(challengeFromParam(''), null);
  assert.equal(challengeFromParam('not-an-attempt'), null);
  assert.equal(challengeFromParam(`${ATTEMPT}x`), null);
});

test('the banner says who scored what, by right answers, and asks to beat it', () => {
  assert.deepEqual(challengeBanner({ challenger: { name: 'TEST DATA Tunde Bello' }, correct_count: 8, scored_count: 10 }), {
    title: 'TEST scored 8/10',
    line: 'TEST challenged you to this quiz. Can you beat it?',
  });
  assert.deepEqual(challengeBanner({ challenger: { name: 'Tunde' }, correct_count: 0, scored_count: 5 }).title, 'Tunde scored 0/5');
  assert.equal(challengeBanner({ challenger: { name: '  ' }, correct_count: 3, scored_count: 4 }).title, 'A friend scored 3/4');
});

test('the two new notifications read as quiz rows, with titles for a row that comes without one', () => {
  const presentation = read('v2', 'features', 'notifications', 'presentation.ts');
  assert.match(presentation, /space_quiz_live: 'A quiz is live in your Space',/);
  assert.match(presentation, /quiz_challenge_result: 'Someone took your challenge',/);
  // Both carry "quiz" in their type, which is what gives a row the quiz mark.
  assert.match(presentation, /if \(token\.includes\('quiz'\)\) return 'quiz';/);
});

test('the results share a challenge link; the front reads it, shows the banner and starts with from', () => {
  const hook = read('v2', 'features', 'quiz', 'solo', 'use-challenge-friend.ts');
  assert.match(hook, /const path = fromAttempt \? quizChallengeHref\(quizUuid, fromAttempt\) : quizFrontHref\(quizUuid\);/);
  const actions = read('v2', 'features', 'quiz', 'solo', 'results', 'ResultsActions.tsx');
  assert.match(actions, /fromAttempt: attemptUuid,/);
  assert.match(read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptResultsScreen.tsx'), /attemptUuid=\{attempt\.uuid\}/);

  const front = read('v2', 'features', 'quiz', 'solo', 'front', 'QuizFrontScreen.tsx');
  assert.match(front, /const challengeFrom = challengeFromParam\(useSearchParams\(\)\.get\('from'\)\);/);
  assert.match(front, /\.\.\.soloQuizQueries\.challenge\(quizUuid, challengeFrom \?\? ''\),\s*enabled: challengeFrom !== null,/);
  assert.match(front, /const startAttempt = useStartAttempt\(quizUuid, viewerId, challengeFrom\);/);
  assert.match(front, /\{challenger \? \(\s*<div\s+role="note"/);
  // Signing in from a challenge comes back to it.
  assert.match(front, /const returnPath = challengeFrom \? quizChallengeHref\(quizUuid, challengeFrom\) : pathname;/);
  assert.doesNotMatch(front, /signInHref\(pathname\)/);

  const mutations = read('v2', 'features', 'quiz', 'solo', 'mutations.ts');
  assert.match(mutations, /quizAttemptsApi\.start\(quizUuid, from \? \{ reveal_mode, from \} : \{ reveal_mode \}\)/);
  const api = read('lib', 'api', 'channel-quiz.ts');
  assert.match(api, /`\/channel-quizzes\/\$\{quizUuid\}\/challenge\/\$\{attemptUuid\}`/);
});
