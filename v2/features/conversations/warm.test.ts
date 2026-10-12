import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import type { ConversationResponse } from '@/types/chat';
import { markGoneOnServer } from './conversation/gone-marks';
import { markConfidential } from './conversation/mode-marks';
import { checkOnArrival, conversationsQueries, VISIT_CHECK_WINDOW_MS } from './queries';
import { conversationIdOf, warmConversation } from './warm';

// Guard for speed step 2 (a): a tap on a chat starts reading it while the
// route and its code load, into the entry the screen reads, and the screen's
// mount does not read it a second time.
const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');

/** Counts the transcript reads, each answering after `delayMs`. */
function stubReads(delayMs = 5) {
  const reads: string[] = [];
  chatApi.getConversation = async (id: string) => {
    reads.push(id);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return { success: true, data: { id, messages: [] } } as unknown as ConversationResponse;
  };
  return reads;
}

const VIEWER = 7;
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** The screen's observer, built from the same leaf the controller uses. */
function mountScreen(client: QueryClient, conversationId: string) {
  const observer = new QueryObserver(client, conversationsQueries.detail({ conversationId, viewerId: VIEWER }));
  const unsubscribe = observer.subscribe(() => undefined);
  return { observer, unsubscribe };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

test('a tap starts the read, and a screen mounting while it runs joins it: one request', async () => {
  const reads = stubReads(20);
  const client = newClient();
  warmConversation(client, { conversationId: 'c1', viewerId: VIEWER });
  const { observer, unsubscribe } = mountScreen(client, 'c1');
  await settle();
  assert.deepEqual(reads, ['c1']);
  assert.equal(observer.getCurrentResult().data?.id, 'c1');
  unsubscribe();
  client.clear();
});

test("a screen mounting after the tap's read landed sends nothing", async () => {
  const reads = stubReads();
  const client = newClient();
  warmConversation(client, { conversationId: 'c2', viewerId: VIEWER });
  await settle();
  const { observer, unsubscribe } = mountScreen(client, 'c2');
  await settle();
  assert.deepEqual(reads, ['c2']);
  assert.equal(observer.getCurrentResult().data?.id, 'c2');
  unsubscribe();
  client.clear();
});

test('without a tap the arrival still checks: an older copy is read again on mount', async () => {
  const reads = stubReads();
  const client = newClient();
  const { queryKey } = conversationsQueries.detail({ conversationId: 'c3', viewerId: VIEWER });
  client.setQueryData(queryKey, { id: 'c3', messages: [] } as never, {
    updatedAt: Date.now() - VISIT_CHECK_WINDOW_MS - 1000,
  });
  const { unsubscribe } = mountScreen(client, 'c3');
  await settle();
  assert.deepEqual(reads, ['c3']);
  unsubscribe();
  client.clear();
});

test('a tap on a chat read within the window sends nothing; an older copy is re-read at the tap', async () => {
  const reads = stubReads();
  const client = newClient();
  const fresh = conversationsQueries.detail({ conversationId: 'c4', viewerId: VIEWER }).queryKey;
  const older = conversationsQueries.detail({ conversationId: 'c5', viewerId: VIEWER }).queryKey;
  client.setQueryData(fresh, { id: 'c4', messages: [] } as never, { updatedAt: Date.now() - 1000 });
  client.setQueryData(older, { id: 'c5', messages: [] } as never, { updatedAt: Date.now() - 30_000 });
  warmConversation(client, { conversationId: 'c4', viewerId: VIEWER });
  warmConversation(client, { conversationId: 'c5', viewerId: VIEWER });
  await settle();
  assert.deepEqual(reads, ['c5']);
  client.clear();
});

test('a double tap is one read', async () => {
  const reads = stubReads(20);
  const client = newClient();
  warmConversation(client, { conversationId: 'c6', viewerId: VIEWER });
  warmConversation(client, { conversationId: 'c6', viewerId: VIEWER });
  await settle();
  assert.deepEqual(reads, ['c6']);
  client.clear();
});

test("the tap reads into the screen's own key and partition: another viewer's entry stays cold", async () => {
  stubReads();
  const client = newClient();
  warmConversation(client, { conversationId: 'c7', viewerId: VIEWER });
  await settle();
  const mine = conversationsQueries.detail({ conversationId: 'c7', viewerId: VIEWER }).queryKey;
  const other = conversationsQueries.detail({ conversationId: 'c7', viewerId: 8 }).queryKey;
  assert.ok(client.getQueryData(mine));
  assert.equal(client.getQueryData(other), undefined);
  assert.equal(client.getQueryCache().getAll().length, 1, 'no entry of its own');
  // The screen builds its entry from the same leaf with the same two values.
  const controller = read('conversation', 'useConversationController.ts');
  assert.match(controller, /conversationsQueries\.detail\(\{ conversationId, viewerId: serverUserId \}\)/);
  client.clear();
});

test("a confidential chat, by the link's flag or this device's mark, and a gone chat are never read", async () => {
  const reads = stubReads();
  const client = newClient();
  warmConversation(client, { conversationId: 'secret-row', viewerId: VIEWER, confidential: true });
  markConfidential('secret-mark');
  warmConversation(client, { conversationId: 'secret-mark', viewerId: VIEWER });
  markGoneOnServer('gone-chat');
  warmConversation(client, { conversationId: 'gone-chat', viewerId: VIEWER });
  await settle();
  assert.deepEqual(reads, []);
  client.clear();
});

test('a failed tap read is swallowed and leaves the screen to read and show the error', async () => {
  // A 404, which the leaf does not retry: a 5xx is retried once, a second later.
  chatApi.getConversation = async () => {
    throw Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } });
  };
  const client = newClient();
  warmConversation(client, { conversationId: 'c8', viewerId: VIEWER });
  await settle();
  const { queryKey } = conversationsQueries.detail({ conversationId: 'c8', viewerId: VIEWER });
  assert.equal(client.getQueryState(queryKey)?.status, 'error');
  client.clear();
});

test('checkOnArrival: the visit check, unless a read landed within the window', () => {
  assert.equal(checkOnArrival(0), 'always', 'no data yet');
  assert.equal(checkOnArrival(Date.now() - 2000), true, "the tap's read");
  assert.equal(checkOnArrival(Date.now() - VISIT_CHECK_WINDOW_MS - 1), 'always', 'an older copy, or one restored from the device');
});

test('conversationIdOf reads the chat id from a chat href only', () => {
  assert.equal(conversationIdOf('/c/abc-123'), 'abc-123');
  assert.equal(conversationIdOf('/c/abc-123?from=list'), 'abc-123');
  assert.equal(conversationIdOf('/c/abc-123#end'), 'abc-123');
  assert.equal(conversationIdOf('/cases/abc'), null);
  assert.equal(conversationIdOf('/conversations'), null);
});

test("the move-first provider reads in the click, after the chat's entry is pushed, and on a forward onto it", () => {
  const source = read('..', '..', 'shell', 'move-first.tsx');
  assert.match(
    source,
    /raise\(href, kind, title, region, restore\);\s*pushPendingEntry\(href, kind\);[\s\S]*?readAhead\(href, kind, header\?\.confidential\);\s*navigateAfterPaint\(\s*href,\s*tap,/,
  );
  assert.match(source, /raise\(href, frame, undefined, region\);\s*readAhead\(href, frame\);\s*navigateAfterPaint\(href, tap\);/);
  assert.match(source, /if \(kind !== 'conversation'\) return;/);
  assert.match(source, /warmConversation\(queryClient, \{ conversationId, viewerId: userId, confidential \}\)/);
  // Never from a hover or a pointerdown: every read logs a view on the server.
  assert.doesNotMatch(source, /onPointerDown|onPointerEnter|onMouseEnter|onTouchStart/);
  // MoveFirstLink skips the provider for a tap on the chat already open.
  assert.match(source, /if \(!navigate \|\| pathOf\(href\) === pathname\) \{\s*onMove\?\.\(\);\s*return;\s*\}/);
});

test('every link that opens a chat goes through the provider as a conversation move', () => {
  // The rail, the drawer, the list rows, the home recents and the activity
  // rows. The case page's "open in full" link is the one plain chat link: the
  // chat is on screen there, so its transcript is already in the cache.
  const sites: Array<[string, string, RegExp]> = [
    ['rail', read('..', '..', 'shell', 'V2Sidebar.tsx'), /<MoveFirstLink[^>]*href=\{`\/c\/\$\{conversation\.id\}`\}\s*kind="conversation"/],
    ['drawer', read('..', '..', 'shell', 'V2Drawer.tsx'), /<MoveFirstLink[^>]*href=\{`\/c\/\$\{conversation\.id\}`\}\s*kind="conversation"/],
    ['list row', read('list', 'ConversationRow.tsx'), /<MoveFirstLink\s*href=\{`\/c\/\$\{id\}`\}\s*kind="conversation"/],
    ['home recents', read('..', '..', 'shell', 'designs', 'sections', 'HomeSections.tsx'), /href=\{`\/c\/\$\{conversation\.id\}`\}[\s\S]*?move=\{\{\s*kind: 'conversation',/],
    ['activity', read('..', 'activity', 'ActivityTable.tsx'), /href: `\/c\/\$\{row\.conversationId\}`,\s*kind: 'conversation' as const,/],
  ];
  for (const [name, source, pattern] of sites) assert.match(source, pattern, name);
  // A list row passes its confidential flag, so the tap never reads one.
  assert.match(read('list', 'ConversationRow.tsx'), /header=\{\{ title: cleanTitle, confidential: Boolean\(is_confidential\) \}\}/);
});

test('the transcript leaf checks once per arrival with checkOnArrival', () => {
  const source = read('queries.ts');
  assert.match(source, /refetchOnMount: \(query\) => checkOnArrival\(query\.state\.dataUpdatedAt\),/);
});
