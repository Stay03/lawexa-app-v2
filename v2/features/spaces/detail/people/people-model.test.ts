import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NEW_MEMBER_DAYS, joinedRecently } from './people-model';

/* "New" on the People tab: joined in the last 7 days (backend, 16 October
 * 2026). `now` is passed in, as the minute clock passes it in the app. */
const NOW = Date.parse('2026-10-16T20:00:00Z');
const day = 24 * 60 * 60 * 1000;
const member = (joinedAt: string | null, pending = false) => ({ joined_at: joinedAt, is_pending: pending });

test('a member who joined within the last week is New', () => {
  assert.equal(NEW_MEMBER_DAYS, 7);
  assert.equal(joinedRecently(member('2026-10-16T19:59:00Z'), NOW), true);
  assert.equal(joinedRecently(member(new Date(NOW - 6.9 * day).toISOString()), NOW), true);
});

test('seven days or older is not New', () => {
  assert.equal(joinedRecently(member(new Date(NOW - 7 * day).toISOString()), NOW), false);
  assert.equal(joinedRecently(member('2026-09-27T10:00:00Z'), NOW), false);
});

test('an invite not yet accepted, a missing or bad date, or a future date is never New', () => {
  assert.equal(joinedRecently(member('2026-10-16T19:00:00Z', true), NOW), false);
  assert.equal(joinedRecently(member(null), NOW), false);
  assert.equal(joinedRecently(member('not a date'), NOW), false);
  assert.equal(joinedRecently(member('2026-10-17T10:00:00Z'), NOW), false);
});
