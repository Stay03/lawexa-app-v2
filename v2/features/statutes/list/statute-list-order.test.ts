import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { statutesQueries } from '../queries';

/* The statute list is A to Z by default (Stay, 18 October 2026). The API
 * orders by title only when asked (`sort=title`); without it, newest first. */

test('the list asks for A to Z by title when no order is given', async () => {
  const leaf = statutesQueries.infiniteList({ search: 'labour', country: 3, viewerId: 7 });
  // In the key, so the RSC prefetch (which reads its request off the key)
  // and the client are one query.
  assert.deepEqual(leaf.queryKey[3], { search: 'labour', country: 3, sort: 'title', order: 'asc' });

  const sent: unknown[] = [];
  const adapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => {
    sent.push(config.params);
    const data = { success: true, data: [], pagination: { current_page: 1, last_page: 1 } };
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  const client = new QueryClient();
  try {
    await client.fetchInfiniteQuery(leaf);
  } finally {
    apiClient.defaults.adapter = adapter;
    client.clear();
  }
  assert.equal(sent.length, 1);
  assert.equal((sent[0] as { sort?: string }).sort, 'title');
  assert.equal((sent[0] as { order?: string }).order, 'asc');
});

test('a caller that names an order keeps it', () => {
  const leaf = statutesQueries.infiniteList({ sort: 'year', order: 'desc', viewerId: null });
  assert.deepEqual(leaf.queryKey[3], { sort: 'year', order: 'desc' });
});
