import { test } from 'node:test';
import assert from 'node:assert/strict';

import { attemptsLabel, cardBest, ownScore, ownScoreLabel, pointsCaption, runKind, scoreToBeatView, startLabel } from './retake-model';
import { scoreOrNotTaken } from './rows-model';

/* Public quizzes as competitions: first attempt on the board, retakes as practice. TEST DATA. */

const STB = { points: 9400, user: { uuid: 'u-ada', name: 'Ada Obi', avatar_url: null }, achieved_at: '2026-11-25T10:00:00Z' };

test('Start reads Retake once the reader has finished an attempt', () => {
  assert.equal(startLabel(undefined), 'Start quiz');
  assert.equal(startLabel(0), 'Start quiz');
  assert.equal(startLabel(2), 'Retake quiz');
});

test('the Score to Beat names its holder, or You', () => {
  assert.deepEqual(scoreToBeatView(STB, 'u-me'), { points: '9,400', holder: 'Ada Obi', name: 'Ada Obi', you: false, avatarUrl: null, attempts: null });
  // The reader holding it reads "You", and their face keeps their own name (no "YO" initials).
  assert.equal(scoreToBeatView(STB, 'u-ada')?.name, 'Ada Obi');
  assert.equal(scoreToBeatView({ ...STB, attempt_number: 3 }, 'u-me')?.attempts, 'on 3 attempts');
  assert.equal(scoreToBeatView(STB, 'u-ada')?.holder, 'You');
  assert.equal(scoreToBeatView(null, 'u-ada'), null);
  assert.equal(scoreToBeatView({ ...STB, user: { ...STB.user, name: '  ' } }, null)?.holder, 'A former player');
  // The holder's account is gone: the score stays, unnamed.
  assert.deepEqual(scoreToBeatView({ ...STB, user: null }, 'u-ada'), { points: '9,400', holder: 'A former player', name: 'A former player', you: false, avatarUrl: null, attempts: null });
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

test('a listed quiz shows the board score, never the best; an unlisted one keeps its best', () => {
  // Arthur, 25 November 2026: the first attempt is the board score; retakes are practice.
  assert.deepEqual(ownScore({ is_listed: true, viewer_best_points: 9610, viewer_board_points: 8200 }), { kind: 'board', points: 8200 });
  assert.deepEqual(ownScore({ is_listed: true, viewer_best_points: 9610 }, 8200), { kind: 'board', points: 8200 }, 'the board’s own read wins');
  assert.equal(ownScore({ is_listed: true, viewer_best_points: 9610 }), null, 'no board score yet: nothing, never the best');
  assert.deepEqual(ownScore({ is_listed: false, viewer_best_points: 9610 }), { kind: 'best', points: 9610 });
  assert.equal(ownScoreLabel('board'), 'Your board score');
  assert.equal(ownScoreLabel('best'), 'Your best');
  assert.deepEqual(scoreOrNotTaken({ is_listed: true, viewer_best_points: 9610, viewer_board_points: 8200 }, true), { label: 'Board 8,200', taken: true });
  assert.deepEqual(scoreOrNotTaken({ is_listed: true, viewer_best_points: null, viewer_board_points: null }, true), { label: 'Not taken', taken: false });
  assert.equal(scoreOrNotTaken({ is_listed: true, viewer_best_points: 9610 }, true), null);
  assert.deepEqual(scoreOrNotTaken({ is_listed: false, viewer_best_points: 2553 }, true), { label: 'Best 2,553', taken: true });
});

test('a quiz card shows the reader\'s best, retakes included', () => {
  assert.equal(cardBest({ viewer_best_points: 9610, viewer_board_points: 8200 } as { viewer_best_points: number }), 9610);
  assert.equal(cardBest({ viewer_best_points: null }), null);
  assert.equal(cardBest({}), null);
});

test('the Score to Beat says which attempt reached it', () => {
  assert.equal(attemptsLabel(1), 'on 1 attempt');
  assert.equal(attemptsLabel(3), 'on 3 attempts');
  assert.equal(attemptsLabel(null), null);
  assert.equal(attemptsLabel(undefined), null);
  assert.equal(attemptsLabel(0), null);
});
