import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatQueryParams } from '@/lib/api/chat';

test('no flags: no query at all, so the answer is exactly what v1 gets', () => {
  assert.equal(chatQueryParams(), undefined);
  assert.equal(chatQueryParams({}), undefined);
  assert.equal(chatQueryParams({ lazyResults: false, withoutMessages: false }), undefined);
});

test('the transcript without step results asks results=lazy', () => {
  assert.deepEqual(chatQueryParams({ lazyResults: true }), { results: 'lazy' });
});

test('the status check that reads only the status asks messages=none', () => {
  assert.deepEqual(chatQueryParams({ withoutMessages: true }), { messages: 'none' });
});
