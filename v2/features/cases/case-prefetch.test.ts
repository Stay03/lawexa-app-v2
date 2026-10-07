import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { CASE_PREFETCH_HEADER } from '@/lib/api/cases';
import type { CaseDetailResponse } from '@/types/case';
import { canPrefetchCase, drawableCase } from './case-prefetch';
import { casesQueries } from './queries';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');

test('only a signed-in account reads a case ahead of the tap; never a guest or a reader with no session', () => {
  assert.equal(canPrefetchCase({ signedIn: true, userId: 7, role: 'user' }), true);
  assert.equal(canPrefetchCase({ signedIn: true, userId: 7, role: 'researcher' }), true);
  assert.equal(canPrefetchCase({ signedIn: true, userId: 7, role: 'guest' }), false);
  assert.equal(canPrefetchCase({ signedIn: false, userId: null, role: null }), false);
  assert.equal(canPrefetchCase({ signedIn: true, userId: null, role: 'user' }), false);
});

test('the loading boundary draws only a successful answer that carries the case', () => {
  assert.equal(drawableCase(undefined), false);
  assert.equal(drawableCase({ success: false } as unknown as CaseDetailResponse), false);
  assert.equal(drawableCase({ success: true, data: null } as unknown as CaseDetailResponse), false);
  assert.equal(drawableCase({ success: true, data: { id: 1 } } as unknown as CaseDetailResponse), true);
});

test('the prefetch fills the case page\'s exact key and is never kept on the device', () => {
  for (const q of [undefined, 'negligence']) {
    const prefetch = casesQueries.prefetchDetail('nwadike-v-ibekwe', q);
    assert.deepEqual(prefetch.queryKey, casesQueries.detail('nwadike-v-ibekwe', q).queryKey);
    assert.equal('meta' in prefetch, false);
  }
});

test('the prefetch read sends the prefetch header and the open\'s read does not', async () => {
  const seen: Array<Record<string, unknown>> = [];
  const adapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => {
    seen.push({ ...(config.headers as Record<string, unknown>) });
    return { data: { success: true, data: { id: 1 } }, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    const client = new QueryClient();
    await client.prefetchQuery(casesQueries.prefetchDetail('a-case'));
    await casesQueries.detail('a-case').queryFn!({} as never);
  } finally {
    apiClient.defaults.adapter = adapter;
  }
  assert.equal(seen.length, 2);
  assert.equal(seen[0][CASE_PREFETCH_HEADER], '1');
  assert.equal(seen[1][CASE_PREFETCH_HEADER], undefined);
});

test('the case route\'s loading boundary reads the cache without sending a read of its own', () => {
  const boundary = read('detail', 'CaseLoading.tsx');
  assert.match(boundary, /casesQueries\.prefetchDetail\(slug, searchQuery\), enabled: false/);
  assert.match(read('..', '..', '..', 'app', 'v2', 'cases', '[slug]', 'loading.tsx'), /CaseLoading/);
});

test('a search row reads the case on intent and cancels it when the reader moves on', () => {
  const hook = read('list', 'use-case-row-intent.ts');
  assert.match(hook, /prefetchQuery\(casesQueries\.prefetchDetail\(slug, searchQuery\)\)/);
  assert.match(hook, /cancelQueries\(/);
  assert.match(hook, /canPrefetchCase\(/);
  assert.match(read('list', 'CaseRow.tsx'), /useCaseRowIntent\(href, row\.slug, searchQuery\)/);
});
