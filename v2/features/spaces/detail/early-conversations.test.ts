import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { JUST_READ_MS, spacesQueries } from '../queries';
import { startsConversationsEarly } from './early-conversations-model';

/* Speed step 5, Spaces (17 October 2026): a member's Conversations tab starts
 * its first page beside the space's details, and the tab does not read it a
 * second time. */

const here = dirname(fileURLToPath(import.meta.url));

test('only a member who may read content, opening on the Conversations tab, starts it early', () => {
  const member = { eligible: true, cachedRole: 'member', tabParam: null };
  assert.equal(startsConversationsEarly(member), true);
  assert.equal(startsConversationsEarly({ ...member, tabParam: 'chats' }), true);
  assert.equal(startsConversationsEarly({ ...member, cachedRole: 'owner' }), true);
  // Not a member in the cached list, or no list in memory: nothing extra.
  assert.equal(startsConversationsEarly({ ...member, cachedRole: null }), false);
  assert.equal(startsConversationsEarly({ ...member, cachedRole: undefined }), false);
  // A session that may not read content (a signed-out reader).
  assert.equal(startsConversationsEarly({ ...member, eligible: false }), false);
  // Another tab is opening: its own read, not this one.
  assert.equal(startsConversationsEarly({ ...member, tabParam: 'files' }), false);
});

/** Counts the space conversation reads sent through the client. */
async function conversationReads(run: (client: QueryClient) => Promise<void>) {
  let reads = 0;
  const client = new QueryClient();
  const adapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => {
    if (String(config.url).endsWith('/conversations')) reads += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      data: { success: true, data: [], pagination: { current_page: 1, last_page: 1, total: 0, per_page: 20 } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
  try {
    await run(client);
  } finally {
    apiClient.defaults.adapter = adapter;
    client.clear();
  }
  return reads;
}

/** The tab mounting: an observer subscribes with the same options. */
async function tabMounts(client: QueryClient, uuid: string) {
  const observer = new InfiniteQueryObserver(client, spacesQueries.conversations(uuid, { viewerId: 7 }));
  const unsubscribe = observer.subscribe(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 30));
  unsubscribe();
}

test('the early read is the tab\'s: the tab mounting just after it does not read again', async () => {
  const reads = await conversationReads(async (client) => {
    await client.prefetchInfiniteQuery(spacesQueries.conversations('s-1', { viewerId: 7 }));
    await tabMounts(client, 's-1');
  });
  assert.equal(reads, 1);
});

test('a later visit still asks again, as every visit did', async () => {
  const reads = await conversationReads(async (client) => {
    await client.prefetchInfiniteQuery(spacesQueries.conversations('s-2', { viewerId: 7 }));
    // The answer is older than a visit's own read.
    const query = client.getQueryCache().find({ queryKey: spacesQueries.conversations('s-2', { viewerId: 7 }).queryKey });
    query?.setState({ dataUpdatedAt: Date.now() - JUST_READ_MS - 1 });
    await tabMounts(client, 's-2');
  });
  assert.equal(reads, 2);
});

test('the collab frame starts it with the details, once per space', () => {
  // Not the screen: it mounts with the page's server payload, a second after
  // the frame has asked for the details, together with the tab (timed runs,
  // 17 October 2026: one read, +1.2 s, with every input true).
  const frame = readFileSync(join(here, '..', '..', 'collab', 'shell', 'CollabFrame.tsx'), 'utf8');
  assert.match(frame, /useEarlyConversations\(isSpaceRoute \? route\.spaceUuid : null\);/);
  assert.ok(
    frame.indexOf('useEarlyConversations(') > frame.indexOf('spacesQueries.detail(spaceUuid'),
    'beside the details read',
  );
  assert.doesNotMatch(readFileSync(join(here, 'SpaceScreen.tsx'), 'utf8'), /useEarlyConversations/);
  const hook = readFileSync(join(here, 'early-conversations.ts'), 'utf8');
  assert.match(hook, /void queryClient\.prefetchInfiniteQuery\(spacesQueries\.conversations\(spaceUuid, \{ viewerId \}\)\);/);
  assert.match(hook, /\?\.my_role,/);
  assert.match(hook, /tabParam: new URLSearchParams\(window\.location\.search\)\.get\('tab'\),/);
  assert.match(hook, /\}, \[eligible, queryClient, spaceUuid, viewerId\]\);/);
});
