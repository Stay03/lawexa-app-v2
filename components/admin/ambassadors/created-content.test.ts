import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createdContentRows, memberLabel, playLabel, quizzesOf, spacesOf } from './created-content';

/* An ambassador's referrals' Spaces and quizzes on the admin financials
 * screen (Arthur's option A, 3 November 2026). */

test('the tallies read zeros when the server sends none or a broken count', () => {
  assert.deepEqual(spacesOf({ count: 3, members: 12 }), { count: 3, members: 12 });
  assert.deepEqual(quizzesOf({ count: 2, plays: 41 }), { count: 2, plays: 41 });
  // A server from before the tallies.
  assert.deepEqual(spacesOf(undefined), { count: 0, members: 0 });
  assert.deepEqual(quizzesOf(null), { count: 0, plays: 0 });
  // Broken values are none, never a negative or a fraction.
  assert.deepEqual(spacesOf({ count: -1, members: 2.5 }), { count: 0, members: 0 });
});

test('members and plays are counted in words', () => {
  assert.equal(memberLabel(1), '1 member');
  assert.equal(memberLabel(0), '0 members');
  assert.equal(playLabel(1), '1 play');
  assert.equal(playLabel(7), '7 plays');
});

test('the detail lists keep the server order and name a blank one Untitled', () => {
  const rows = createdContentRows({
    spaces: [
      { uuid: 's-2', name: 'TEST DATA moot club', members: 9, created_at: '2026-11-02T10:00:00Z' },
      { uuid: 's-1', name: '  ', members: 1, created_at: '2026-10-30T10:00:00Z' },
    ],
    quizzes: [{ uuid: 'q-1', title: 'TEST DATA contract basics', plays: 0, created_at: '2026-11-01T10:00:00Z' }],
  });
  assert.deepEqual(
    rows.spaces.map(({ name, detail }) => ({ name, detail })),
    [
      { name: 'TEST DATA moot club', detail: '9 members' },
      { name: 'Untitled Space', detail: '1 member' },
    ],
  );
  assert.deepEqual(rows.quizzes.map(({ title, detail }) => ({ title, detail })), [{ title: 'TEST DATA contract basics', detail: '0 plays' }]);
});

test('an ambassador whose referrals made nothing has two empty lists', () => {
  assert.deepEqual(createdContentRows({ spaces: [], quizzes: [] }), { spaces: [], quizzes: [] });
  assert.deepEqual(createdContentRows(undefined), { spaces: [], quizzes: [] });
});
