import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readOnOpen } from './read-on-open';

/* Opening a report marks it read once per opening, from the state it opened
 * in (Tester, live, 26 October 2026: Mark unread on a report opened already
 * read sent read:false, then read:true in the same second). */

const unread = { status: 'completed', read_at: null };
const read = { status: 'completed', read_at: '2026-10-26T15:00:00Z' };

test('an unread report is marked read when it opens', () => {
  assert.equal(readOnOpen(false, unread), 'mark-read');
});

test('a report opened already read is left, and stays left after Mark unread', () => {
  assert.equal(readOnOpen(false, read), 'leave');
  // Mark unread clears read_at; the opening has decided, so nothing is sent.
  assert.equal(readOnOpen(true, unread), 'leave');
});

test('a report still being written waits, and is decided when it completes', () => {
  assert.equal(readOnOpen(false, null), 'wait');
  assert.equal(readOnOpen(false, { status: 'running', read_at: null }), 'wait');
  assert.equal(readOnOpen(false, { status: 'completed', read_at: null }), 'mark-read');
});
