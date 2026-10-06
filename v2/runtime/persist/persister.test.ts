import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryObserver, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { makeQueryClient, type V2QueryMeta } from '../query';
import { memoryBackend } from './memory-backend';
import { makeV2Persister, PERSIST_PREFIX } from './persister';
import { createQueryStorage, type QueryStorage } from './query-storage';

/** Lets the persister's scheduled writes and restore-refetches run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

/** One device: a storage that outlives the "tabs" (query clients) built on it. */
function device(owner = '7') {
  const mem = memoryBackend();
  const storage = createQueryStorage(mem.backend);
  storage.setOwner(owner);
  return { ...mem, storage };
}

/** A fresh tab on the same device: a new client, empty memory cache. */
function tab(storage: QueryStorage): QueryClient {
  return makeQueryClient({ persister: makeV2Persister(storage).persisterFn });
}

function read(
  client: QueryClient,
  queryKey: QueryKey,
  answer: () => Promise<unknown>,
  meta: V2QueryMeta | undefined,
  staleTime = 60_000,
) {
  return client.fetchQuery({ queryKey, queryFn: answer, meta, staleTime });
}

const rowKey = (client: QueryClient, queryKey: QueryKey) =>
  `7/${PERSIST_PREFIX}-${client.getQueryCache().build(client, { queryKey }).queryHash}`;

const fullCase = { success: true, data: { slug: 'a', body: '<p>full judgment</p>', limit_exceeded: false } };
const limitedCase = { success: true, data: { slug: 'a', body: null, limit_exceeded: true } };
const notFound = () => Promise.reject(Object.assign(new Error('Request failed'), { response: { status: 404 } }));

test('a query without meta.persist is never kept and never restored', async () => {
  const { storage, answers } = device();
  const client = tab(storage);
  await read(client, ['subscription', 'current'], async () => ({ success: true, data: { plan: { id: 2 } } }), undefined);
  await settle();
  assert.equal(answers.size, 0);
});

test('a list answer is kept, and a reopened tab paints it without waiting for the network', async () => {
  const { storage, answers } = device();
  const key = ['cases', 'list', { viewerId: 7 }];
  const first = tab(storage);
  await read(first, key, async () => ({ success: true, data: [{ id: 1 }] }), { persist: 'list' });
  await settle();
  assert.equal(answers.has(rowKey(first, key)), true);

  let calls = 0;
  const second = tab(storage);
  const shown = await read(second, key, async () => {
    calls += 1;
    return { success: true, data: [{ id: 1 }, { id: 2 }] };
  }, { persist: 'list' });
  assert.deepEqual(shown, { success: true, data: [{ id: 1 }] });
  await settle();
  // Fresh inside its stale time: no request on reopen.
  assert.equal(calls, 0);
});

test('a stale list copy paints and is then refetched', async () => {
  const { storage } = device();
  const key = ['cases', 'list', { viewerId: 7 }];
  await read(tab(storage), key, async () => ({ success: true, data: [{ id: 1 }] }), { persist: 'list' });
  await settle();

  // As on a screen: `useQuery` is an observer, and staleness is the observer's.
  let calls = 0;
  const second = tab(storage);
  const observer = new QueryObserver(second, {
    queryKey: key,
    queryFn: async () => {
      calls += 1;
      return { success: true, data: [{ id: 1 }, { id: 2 }] };
    },
    meta: { persist: 'list' },
    staleTime: 0,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await settle();
  unsubscribe();
  assert.equal(calls, 1);
  assert.deepEqual(second.getQueryData(key), { success: true, data: [{ id: 1 }, { id: 2 }] });
});

test('a gated page is ALWAYS read again on open, even when the copy is fresh', async () => {
  const { storage } = device();
  const key = ['cases', 'detail', 'a', { q: null }];
  await read(tab(storage), key, async () => fullCase, { persist: 'gated' });
  await settle();

  let calls = 0;
  const second = tab(storage);
  await read(second, key, async () => {
    calls += 1;
    return fullCase;
  }, { persist: 'gated' }, 10 * 60_000);
  await settle();
  assert.equal(calls, 1);
});

test('a lapsed plan: the kept full judgment is replaced by the limited answer and its row deleted', async () => {
  const { storage, answers } = device();
  const key = ['cases', 'detail', 'a', { q: null }];
  const first = tab(storage);
  await read(first, key, async () => fullCase, { persist: 'gated' });
  await settle();
  assert.equal(answers.has(rowKey(first, key)), true);

  const second = tab(storage);
  await read(second, key, async () => limitedCase, { persist: 'gated' }, 10 * 60_000);
  await settle();
  assert.deepEqual(second.getQueryData(key), limitedCase);
  assert.equal(answers.has(rowKey(second, key)), false);

  // And the next open has nothing to paint.
  let calls = 0;
  const third = tab(storage);
  const shown = await read(third, key, async () => {
    calls += 1;
    return limitedCase;
  }, { persist: 'gated' });
  assert.deepEqual(shown, limitedCase);
  assert.equal(calls, 1);
});

test('a limited first read is shown and never kept', async () => {
  const { storage, answers } = device();
  const client = tab(storage);
  const shown = await read(client, ['cases', 'detail', 'b', { q: null }], async () => limitedCase, { persist: 'gated' });
  await settle();
  assert.deepEqual(shown, limitedCase);
  assert.equal(answers.size, 0);
});

test('a 404 (gone, or went private) deletes the kept copy and still fails', async () => {
  const { storage, answers } = device();
  const key = ['notes', 'detail', 'n', { viewerId: 7 }];
  const note = { success: true, data: { slug: 'n', content: '<p>x</p>', has_access: true } };
  const first = tab(storage);
  await read(first, key, async () => note, { persist: 'gated' });
  await settle();
  assert.equal(answers.size, 1);

  // A reload whose restore paints, then the always-refetch meets the 404.
  const second = tab(storage);
  await read(second, key, notFound, { persist: 'gated' });
  await settle();
  assert.equal(answers.size, 0);

  // Asked directly with nothing kept, the 404 is the answer.
  await assert.rejects(read(tab(storage), key, notFound, { persist: 'gated' }));
});

test('a 429 keeps the copy: the item has not changed, the request failed', async () => {
  const { storage, answers } = device();
  const key = ['cases', 'detail', 'c', { q: null }];
  await read(tab(storage), key, async () => fullCase, { persist: 'gated' });
  await settle();
  const second = tab(storage);
  second.setDefaultOptions({ queries: { ...second.getDefaultOptions().queries, retry: false } });
  await read(second, key, () => Promise.reject(Object.assign(new Error('Too Many'), { response: { status: 429 } })), { persist: 'gated' });
  await settle();
  assert.equal(answers.size, 1);
});

test('a chat still being answered is not kept; once answered it is', async () => {
  const { storage, answers } = device();
  const key = ['conversations', 'detail', 'c1', { viewerId: 7 }];
  const client = tab(storage);
  await read(client, key, async () => ({ id: 'c1', messages: [{ role: 'user' }] }), { persist: 'gated' }, 0);
  await settle();
  assert.equal(answers.size, 0);
  await read(client, key, async () => ({ id: 'c1', messages: [{ role: 'user' }, { role: 'assistant' }] }), { persist: 'gated' }, 0);
  await settle();
  assert.equal(answers.size, 1);
});

test('another account on the same device never sees the first account\'s copy', async () => {
  const { storage } = device('7');
  const key = ['cases', 'detail', 'a', { q: null }];
  await read(tab(storage), key, async () => fullCase, { persist: 'gated' });
  await settle();

  storage.setOwner('8');
  let calls = 0;
  const shown = await read(tab(storage), key, async () => {
    calls += 1;
    return limitedCase;
  }, { persist: 'gated' });
  assert.deepEqual(shown, limitedCase);
  assert.equal(calls, 1);
});

test('a server-rendered answer already in the cache wins over the device copy', async () => {
  const { storage } = device();
  const key = ['cases', 'detail', 'a', { q: null }];
  await read(tab(storage), key, async () => fullCase, { persist: 'gated' });
  await settle();

  const second = tab(storage);
  const hydrated = { success: true, data: { slug: 'a', body: '<p>server copy</p>', limit_exceeded: false } };
  second.setQueryData(key, hydrated);
  const shown = await read(second, key, async () => fullCase, { persist: 'gated' }, 10 * 60_000);
  assert.deepEqual(shown, hydrated);
});
