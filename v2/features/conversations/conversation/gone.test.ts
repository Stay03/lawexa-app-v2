import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { goneOnServer } from './gone';
import { isGoneMark, markGoneOnServer } from './gone-marks';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), 'utf8');
const axiosError = (status: number) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });

/** One good read of a conversation, then a re-read that fails with `error`; returns what the screen sees. */
async function heldThenReread(error: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let reads = 0;
  const observer = new QueryObserver(client, {
    queryKey: ['conversations', 'detail', 'c1', { viewerId: 7 }],
    queryFn: async () => {
      reads += 1;
      if (reads === 1) return { id: 'c1', messages: [{ role: 'assistant', content: 'held' }] };
      throw error;
    },
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await observer.refetch(); // the held copy
  await observer.refetch(); // the re-read on arrival
  const result = observer.getCurrentResult();
  unsubscribe();
  client.clear();
  return { gone: goneOnServer(result), stillHeld: result.data !== undefined };
}

test('a held conversation whose re-read answers 404 or 403 is "not available"', async () => {
  for (const status of [404, 403, 410]) {
    const { gone, stillHeld } = await heldThenReread(axiosError(status));
    assert.equal(gone, true, String(status));
    assert.equal(stillHeld, true, `${status}: the screen held it, so this is a RE-read`);
  }
});

test('a 5xx, a 429 or a timeout keeps the transcript on screen', async () => {
  for (const error of [axiosError(500), axiosError(503), axiosError(429), new Error('timeout of 30000ms exceeded')]) {
    const { gone, stillHeld } = await heldThenReread(error);
    assert.equal(gone, false, error.message);
    assert.equal(stillHeld, true, error.message);
  }
});

test('a 401 is not "not available": the session ended, which the identity guard handles', async () => {
  const { gone } = await heldThenReread(axiosError(401));
  assert.equal(gone, false);
});

test('a FIRST read that fails is left to the mount flow (it already maps 404 to not available)', () => {
  assert.equal(goneOnServer({ isRefetchError: false, error: axiosError(404) }), false);
  assert.match(read('useConversationController.ts'), /if \(status === 404\) return 'not_found';/);
});

test('the gone mark is set once and stays for the visit', () => {
  assert.equal(isGoneMark('gone-1'), false);
  markGoneOnServer('gone-1');
  markGoneOnServer('gone-1');
  assert.equal(isGoneMark('gone-1'), true);
  assert.equal(isGoneMark('gone-2'), false);
});

test('once gone, the screen shows "not available" and the app drops its copies without reading again', () => {
  const controller = read('useConversationController.ts');
  // The mark disables the read, so dropping the query cannot start a new one.
  assert.match(controller, /const detailQuery = useQuery\(\{ \.\.\.detailOptions, enabled: !isConfidential && !isGoneMarked \}\);/);
  assert.match(controller, /const isGoneOnServer = isGoneMarked \|\| \(!isConfidential && goneOnServer\(detailQuery\)\);/);
  // Mark first, then drop memory and the list rows.
  assert.match(
    controller,
    /markGoneOnServer\(conversationId\);\s*conversationsCache\.remove\(queryClient, conversationId\);\s*void queryClient\.invalidateQueries\(\{ queryKey: conversationsQueries\.lists\(\) \}\);\s*queryClient\.removeQueries\(\{ queryKey: \[\.\.\.conversationsQueries\.details\(\), conversationId\] \}\);/,
  );
  // The device copy: the persister deletes it on the failed re-read.
  assert.match(readFileSync(join(here, '..', '..', '..', 'runtime', 'persist', 'persister.ts'), 'utf8'), /if \(isGoneError\(error\)\) await storage\.removeItem\(keyOf\(query\)\);/);
  const screen = read('ConversationScreen.tsx');
  assert.match(screen, /if \(error === 'not_found' \|\| controller\.isGoneOnServer\) \{\s*return <NotAvailableState \/>;/);
});
