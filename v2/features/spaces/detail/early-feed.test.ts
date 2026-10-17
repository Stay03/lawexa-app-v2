import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { JUST_READ_MS, spacesQueries } from '../queries';
import { startsFeedEarly } from './early-feed-model';

/* Speed step 5, Spaces (17 October 2026): a member's space home starts its
 * All list beside the space's details, and the list does not read it a second
 * time (the one list since design B4). */

const here = dirname(fileURLToPath(import.meta.url));

test('only a member who may read content, opening on All, starts it early', () => {
  const member = { eligible: true, cachedRole: 'member', tabParam: null };
  assert.equal(startsFeedEarly(member), true);
  // The old tab ids open All too (`parseSpaceTab`).
  assert.equal(startsFeedEarly({ ...member, tabParam: 'chats' }), true);
  assert.equal(startsFeedEarly({ ...member, tabParam: 'channels' }), true);
  assert.equal(startsFeedEarly({ ...member, cachedRole: 'owner' }), true);
  // Not a member in the cached list, or no list in memory: nothing extra.
  assert.equal(startsFeedEarly({ ...member, cachedRole: null }), false);
  assert.equal(startsFeedEarly({ ...member, cachedRole: undefined }), false);
  // A session that may not read content (a signed-out reader).
  assert.equal(startsFeedEarly({ ...member, eligible: false }), false);
  // Another pill is opening: its own read, not this one.
  assert.equal(startsFeedEarly({ ...member, tabParam: 'files' }), false);
});

/** Counts the space feed reads sent through the client. */
async function feedReads(run: (client: QueryClient) => Promise<void>) {
  let reads = 0;
  const client = new QueryClient();
  const adapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => {
    if (String(config.url).endsWith('/items')) reads += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      data: {
        success: true,
        message: 'ok',
        data: [],
        pagination: { per_page: 20, has_more: false, next_cursor: null, prev_cursor: null },
      },
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

/** The list mounting: an observer subscribes with the same options. */
async function listMounts(client: QueryClient, uuid: string) {
  const observer = new InfiniteQueryObserver(client, spacesQueries.items(uuid, { viewerId: 7 }));
  const unsubscribe = observer.subscribe(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 30));
  unsubscribe();
}

test('the early read is the list\'s: the list mounting just after it does not read again', async () => {
  const reads = await feedReads(async (client) => {
    await client.prefetchInfiniteQuery(spacesQueries.items('s-1', { viewerId: 7 }));
    await listMounts(client, 's-1');
  });
  assert.equal(reads, 1);
});

test('a later visit still asks again, as every visit did', async () => {
  const reads = await feedReads(async (client) => {
    await client.prefetchInfiniteQuery(spacesQueries.items('s-2', { viewerId: 7 }));
    // The answer is older than a visit's own read.
    const query = client.getQueryCache().find({ queryKey: spacesQueries.items('s-2', { viewerId: 7 }).queryKey });
    query?.setState({ dataUpdatedAt: Date.now() - JUST_READ_MS - 1 });
    await listMounts(client, 's-2');
  });
  assert.equal(reads, 2);
});

test('the collab frame starts it with the details, once per space', () => {
  // Not the screen: it mounts with the page's server payload, a second after
  // the frame has asked for the details, together with the list (timed runs,
  // 17 October 2026: one read, +1.2 s, with every input true).
  const frame = readFileSync(join(here, '..', '..', 'collab', 'shell', 'CollabFrame.tsx'), 'utf8');
  assert.match(frame, /useEarlyFeed\(isSpaceRoute \? route\.spaceUuid : null\);/);
  assert.ok(
    frame.indexOf('useEarlyFeed(') > frame.indexOf('spacesQueries.detail(spaceUuid'),
    'beside the details read',
  );
  assert.doesNotMatch(readFileSync(join(here, 'SpaceScreen.tsx'), 'utf8'), /useEarlyFeed/);
  const hook = readFileSync(join(here, 'early-feed.ts'), 'utf8');
  // The home's own ask, rooms included where they show, so the home finds it.
  assert.match(hook, /const rooms = spaceKind\(cached\) === 'team' && teamChannels;/);
  assert.match(hook, /void queryClient\.prefetchInfiniteQuery\(spacesQueries\.items\(spaceUuid, \{ viewerId, rooms \}\)\);/);
  assert.match(hook, /cachedRole: cached\?\.my_role,/);
  assert.match(hook, /tabParam: new URLSearchParams\(window\.location\.search\)\.get\('tab'\),/);
  assert.match(hook, /\}, \[eligible, queryClient, spaceUuid, viewerId, teamChannels\]\);/);
});
