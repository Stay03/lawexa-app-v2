import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { CASE_PREFETCH_HEADER } from '@/lib/api/cases';
import type { CaseDetailResponse } from '@/types/case';
import { casesQueries } from './queries';

/* "No search" is one case key (speed step 4, 17 October 2026). The library
 * passes an empty search to every row and the case page passes none; backend's
 * cache log showed a read filed under { q: '' } that the page, asking for
 * { q: null }, never found. The techlead's ask: count requests, not keys. */

const SLUG = 'ada-v-obi';
const ANSWER = { success: true, data: { id: 9, slug: SLUG } } as unknown as CaseDetailResponse;

/** The case reads sent through the client, and whether each carried the
 *  prefetch header (a read that counts no view). */
async function countingReads(run: (client: QueryClient) => Promise<void>) {
  const reads: Array<{ prefetch: boolean }> = [];
  const client = new QueryClient();
  const adapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => {
    reads.push({ prefetch: (config.headers as Record<string, unknown>)[CASE_PREFETCH_HEADER] === '1' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { data: ANSWER, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    await run(client);
  } finally {
    apiClient.defaults.adapter = adapter;
    // Drops the entries and their garbage-collection timers, so the test
    // process can exit.
    client.clear();
  }
  return reads;
}

test('every spelling of no search is one key; a real search is its own', () => {
  const page = casesQueries.detail(SLUG).queryKey;
  for (const q of ['', '   ', undefined]) {
    assert.deepEqual(casesQueries.detail(SLUG, q).queryKey, page, JSON.stringify(q));
    assert.deepEqual(casesQueries.prefetchDetail(SLUG, q).queryKey, page, JSON.stringify(q));
  }
  assert.deepEqual(
    casesQueries.detail(SLUG, ' negligence ').queryKey,
    casesQueries.detail(SLUG, 'negligence').queryKey,
  );
  assert.notDeepEqual(casesQueries.detail(SLUG, 'negligence').queryKey, page);
});

test('a read with any spelling of no search is the one the page uses: one request, one entry', async () => {
  for (const first of ['', '   ', undefined]) {
    for (const page of ['', '   ', undefined]) {
      let entries = 0;
      const reads = await countingReads(async (client) => {
        await client.prefetchQuery(casesQueries.detail(SLUG, first));
        await client.fetchQuery(casesQueries.detail(SLUG, page));
        entries = client.getQueryCache().findAll({ queryKey: casesQueries.details() }).length;
      });
      const label = `first ${JSON.stringify(first)}, page ${JSON.stringify(page)}`;
      assert.deepEqual(reads, [{ prefetch: false }], label);
      assert.equal(entries, 1, label);
    }
  }
});

test('a desktop hover read with no search is the answer the page draws: no second request', async () => {
  for (const rowSearch of ['', undefined]) {
    const reads = await countingReads(async (client) => {
      await client.prefetchQuery(casesQueries.prefetchDetail(SLUG, rowSearch));
      await client.fetchQuery(casesQueries.detail(SLUG));
    });
    assert.deepEqual(reads, [{ prefetch: true }], JSON.stringify(rowSearch));
  }
});
