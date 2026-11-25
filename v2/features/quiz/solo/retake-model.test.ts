import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pointsCaption, runKind, scoreToBeatView, startLabel } from './retake-model';

/* Public quizzes as competitions: first attempt on the board, retakes as practice. TEST DATA. */

const STB = { points: 9400, user: { uuid: 'u-ada', name: 'Ada Obi', avatar_url: null }, achieved_at: '2026-11-25T10:00:00Z' };

test('Start reads Retake once the reader has finished an attempt', () => {
  assert.equal(startLabel(undefined), 'Start quiz');
  assert.equal(startLabel(0), 'Start quiz');
  assert.equal(startLabel(2), 'Retake quiz');
});

test('the Score to Beat names its holder, or You', () => {
  assert.deepEqual(scoreToBeatView(STB, 'u-me'), { points: '9,400', holder: 'Ada Obi', you: false, avatarUrl: null });
  assert.equal(scoreToBeatView(STB, 'u-ada')?.holder, 'You');
  assert.equal(scoreToBeatView(null, 'u-ada'), null);
  assert.equal(scoreToBeatView({ ...STB, user: { ...STB.user, name: '  ' } }, null)?.holder, 'A player');
});

test('a retake is practice, with the board score that stays', () => {
  const run = runKind({ is_board_attempt: false, attempt_number: 3, board_points: 8200, holds_score_to_beat: false });
  assert.deepEqual(run, { kind: 'practice', holdsScoreToBeat: false, line: 'Practice run. Your board score stays 8,200.' });
  assert.equal(pointsCaption(run), 'practice points');
});

test('a retake that took the Score to Beat is still practice, and says it holds it', () => {
  const run = runKind({ is_board_attempt: false, attempt_number: 2, board_points: 8200, holds_score_to_beat: true });
  assert.equal(run.kind, 'practice');
  assert.equal(run.kind === 'practice' && run.holdsScoreToBeat, true);
});

test('the first attempt is the board one; an older server reads as before; an ineligible attempt is neither', () => {
  assert.deepEqual(runKind({ is_board_attempt: true, attempt_number: 1, board_points: null, holds_score_to_beat: true }), { kind: 'board', holdsScoreToBeat: true });
  assert.deepEqual(runKind({}), { kind: 'board', holdsScoreToBeat: false });
  assert.deepEqual(runKind({ is_board_attempt: false, attempt_number: null, board_points: null, holds_score_to_beat: false }), { kind: 'none' });
  assert.equal(pointsCaption({ kind: 'board', holdsScoreToBeat: false }), 'points');
});
