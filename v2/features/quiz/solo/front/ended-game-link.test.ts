import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { endedGameQuiz, endedGameQuizPath } from '@/lib/utils/ended-game';

/* A live game's link after the game ended (Arthur, 16 November 2026; Backend's 410 shape): when its quiz can be
 * taken alone, the link opens the quiz with a note instead of "This invite has expired". TEST DATA. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const QUIZ = '38f6e5f9-dca0-46f7-bcac-d04916788fd5';
const ended = (quiz: Record<string, unknown>) => ({ success: false, message: 'TEST DATA. This live game has ended.', errors: { code: 'game_ended', quiz } });

test('an ended game whose quiz can be taken alone opens the quiz', () => {
  assert.deepEqual(endedGameQuiz(410, ended({ uuid: QUIZ, title: 'TEST DATA Torts', solo_playable: true })), { uuid: QUIZ, title: 'TEST DATA Torts' });
  assert.equal(endedGameQuizPath(QUIZ), `/quiz/q/${QUIZ}?ended=1`);
});

test('every other answer keeps the expired screen', () => {
  assert.equal(endedGameQuiz(410, ended({ uuid: QUIZ, title: 'x', solo_playable: false })), null, 'not playable alone');
  assert.equal(endedGameQuiz(410, { success: false, message: 'This invite has expired.' }), null, 'an expired invite');
  // Backend 7f772d5a: quiz is null when the game or its quiz is gone; other 410s send errors: null.
  assert.equal(endedGameQuiz(410, { success: false, message: 'The game behind this link has ended.', errors: { code: 'game_ended', quiz: null } }), null, 'game or quiz gone');
  assert.equal(endedGameQuiz(410, { success: false, message: 'x', errors: null }), null, 'another 410');
  assert.equal(endedGameQuiz(410, { errors: { code: 'expired' } }), null);
  assert.equal(endedGameQuiz(404, ended({ uuid: QUIZ, solo_playable: true })), null);
  assert.equal(endedGameQuiz(410, ended({ uuid: '../../admin', solo_playable: true })), null, 'only a quiz uuid becomes a path');
  assert.equal(endedGameQuiz(410, null), null);
  assert.equal(endedGameQuiz(410, 'gone'), null);
});

test('the preview and the accept both go to the quiz, and the quiz page says the game ended', () => {
  const screen = read('components', 'join', 'JoinScreen.tsx');
  assert.match(screen, /if \(ended\) \{\s*router\.replace\(endedGameQuizPath\(ended\.uuid\)\);\s*return;\s*\}/);
  assert.match(screen, /if \(endedQuizUuid\) \{\s*forgetPendingInvite\(\);\s*router\.replace\(endedGameQuizPath\(endedQuizUuid\)\);/);
  const front = read('v2', 'features', 'quiz', 'solo', 'front', 'QuizFrontScreen.tsx');
  assert.match(front, /export const GAME_ENDED_NOTE = 'This live game has ended\. Take the quiz yourself\.';/);
  assert.match(front, /const gameEnded = searchParams\.get\('ended'\) === '1';/);
});
