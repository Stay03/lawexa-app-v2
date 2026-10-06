import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CaseDetailResponse } from '@/types/case';
import { caseDetailState } from './case-prefetch-state';

const KEY = ['cases', 'detail', 'nwadike-v-ibekwe', { q: null }] as const;

/** The error `apiFetch` throws on a non-2xx answer: a message and a status. */
function answered(status: number) {
  return () => Promise.reject(Object.assign(new Error(`apiFetch failed: ${status}`), { status }));
}

test('a 401 for a dead cookie token hydrates nothing, so the screen fetches with its own token', async () => {
  assert.equal(await caseDetailState(KEY, answered(401)), undefined);
});

test('any other failed read hydrates nothing: 403, 429, 500, a timeout', async () => {
  for (const status of [403, 429, 500]) assert.equal(await caseDetailState(KEY, answered(status)), undefined);
  const timeout = () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'));
  assert.equal(await caseDetailState(KEY, timeout), undefined);
});

test('an answer without the case hydrates nothing', async () => {
  const empty = { success: false, data: null } as unknown as CaseDetailResponse;
  assert.equal(await caseDetailState(KEY, () => Promise.resolve(empty)), undefined);
});

test('a full answer hydrates exactly one query, under the screen key', async () => {
  const detail = { success: true, data: { slug: 'nwadike-v-ibekwe' } } as unknown as CaseDetailResponse;
  const state = await caseDetailState(KEY, () => Promise.resolve(detail));
  assert.ok(state);
  assert.equal(state.queries.length, 1);
  assert.deepEqual(state.queries[0].queryKey, KEY);
  assert.equal(state.queries[0].state.data, detail);
});
