import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGoneError,
  isStorableAnswer,
  PERSIST_MAX_AGE_MS,
  PERSIST_MAX_ENTRY_BYTES,
  PERSIST_MAX_ROWS,
  PERSIST_MAX_TOTAL_BYTES,
  PERSIST_READ_TIMEOUT_MS,
  persistModeOf,
  planKeyOf,
  trimPlan,
} from './policy';

test('the caps are the plan and its amendments: 7 days, 1 MiB a row, 200 rows, 50 MB, 1.5 s', () => {
  assert.equal(PERSIST_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(PERSIST_MAX_ENTRY_BYTES, 1024 * 1024);
  assert.equal(PERSIST_MAX_ROWS, 200);
  assert.equal(PERSIST_MAX_TOTAL_BYTES, 50 * 1024 * 1024);
  assert.equal(PERSIST_READ_TIMEOUT_MS, 1500);
});

test('only an explicit list or gated flag opts a query in', () => {
  assert.equal(persistModeOf({ persist: 'list' }), 'list');
  assert.equal(persistModeOf({ persist: 'gated' }), 'gated');
  assert.equal(persistModeOf(undefined), null);
  assert.equal(persistModeOf({}), null);
  assert.equal(persistModeOf({ persist: true }), null);
  assert.equal(persistModeOf({ silentError: true }), null);
});

test('a full case read is kept; a case over the plan limit is not', () => {
  assert.equal(isStorableAnswer({ success: true, data: { slug: 'a', body: '<p>full</p>', limit_exceeded: false } }), true);
  assert.equal(isStorableAnswer({ success: true, data: { slug: 'a', body: null, limit_exceeded: true } }), false);
});

test('a note read without access is not kept', () => {
  assert.equal(isStorableAnswer({ success: true, data: { slug: 'n', content: '<p>x</p>', has_access: true } }), true);
  assert.equal(isStorableAnswer({ success: true, data: { slug: 'n', has_access: false } }), false);
});

test('a failed envelope or a missing body is not kept', () => {
  assert.equal(isStorableAnswer({ success: false, message: 'nope' }), false);
  assert.equal(isStorableAnswer({ success: true, data: null }), false);
  assert.equal(isStorableAnswer(undefined), false);
});

test('a confidential or redacted chat is never kept', () => {
  const done = [{ role: 'user' }, { role: 'assistant' }];
  assert.equal(isStorableAnswer({ id: 'c', messages: done }), true);
  assert.equal(isStorableAnswer({ id: 'c', messages: done, is_confidential: true }), false);
  assert.equal(isStorableAnswer({ id: 'c', messages: done, is_redacted: true }), false);
});

test('a chat whose last message is the reader\'s own (reply not saved yet) is not kept', () => {
  assert.equal(isStorableAnswer({ id: 'c', messages: [{ role: 'assistant' }, { role: 'user' }] }), false);
  assert.equal(isStorableAnswer({ id: 'c', messages: [] }), true);
});

test('lists, infinite pages and plain arrays are kept', () => {
  assert.equal(isStorableAnswer({ pages: [{ data: [] }], pageParams: [1] }), true);
  assert.equal(isStorableAnswer([{ id: 1 }]), true);
});

test('401, 403, 404, 410 and a confidential chat delete the kept copy; a 429, 5xx or timeout do not', () => {
  for (const status of [401, 403, 404, 410]) assert.equal(isGoneError({ response: { status } }), true, String(status));
  assert.equal(isGoneError(Object.assign(new Error('confidential'), { name: 'ConfidentialConversationError' })), true);
  for (const status of [429, 500, 503]) assert.equal(isGoneError({ response: { status } }), false, String(status));
  assert.equal(isGoneError(new Error('timeout of 30000ms exceeded')), false);
  assert.equal(isGoneError(undefined), false);
});

test('trimming removes the oldest rows until both caps hold', () => {
  const rows = [
    { key: 'c', bytes: 10, at: 3 },
    { key: 'a', bytes: 10, at: 1 },
    { key: 'b', bytes: 10, at: 2 },
  ];
  assert.deepEqual(trimPlan(rows, 3, 100), []);
  assert.deepEqual(trimPlan(rows, 2, 100), ['a']);
  assert.deepEqual(trimPlan(rows, 3, 15), ['a', 'b']);
  assert.deepEqual(trimPlan([], 1, 1), []);
});

test('the plan fingerprint changes with the plan, the status, or free vs paid', () => {
  const base = { success: true, data: { plan: { id: 2 }, subscription: { status: 'active' }, is_free_tier: false } };
  assert.equal(planKeyOf(base), '2:active:paid');
  assert.equal(planKeyOf({ ...base, data: { ...base.data, subscription: { status: 'expired' } } }), '2:expired:paid');
  assert.equal(planKeyOf({ success: true, data: { plan: { id: 1 }, subscription: null, is_free_tier: true } }), '1:none:free');
  assert.equal(planKeyOf(undefined), null);
  assert.equal(planKeyOf({ success: true, data: { plan: null } }), null);
});
