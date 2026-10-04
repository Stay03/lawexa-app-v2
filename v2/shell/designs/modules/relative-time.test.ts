import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRelativeTime } from './meta';

/* #15: the server and the hydrating browser read the clock seconds apart, so
 * the home sections pass no clock until mounted. */
const at = Date.parse('2026-10-04T21:00:00Z');

test('no clock yet (server render and hydration) prints nothing', () => {
  assert.equal(formatRelativeTime('2026-10-04T20:55:30Z', null), '');
});

test('the edge that made server and browser disagree', () => {
  // 4m29s and 4m31s round to different minutes: the two renders a few
  // seconds apart could print "4m" and "5m" for the same row.
  assert.equal(formatRelativeTime('2026-10-04T20:55:31Z', at), '4m');
  assert.equal(formatRelativeTime('2026-10-04T20:55:29Z', at), '5m');
});

test('a mounted clock formats as before', () => {
  assert.equal(formatRelativeTime('2026-10-04T18:00:00Z', at), '3h');
  assert.equal(formatRelativeTime(null, at), '');
  assert.equal(formatRelativeTime('not a date', at), '');
});
