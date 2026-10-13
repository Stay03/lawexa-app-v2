import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import type { ConversationListItem, ConversationsListResponse } from '@/types/chat';
import type { SpaceConversationListResponse } from '@/types/collab';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { lastActivityAt, lastActivityRank, uniqueRowsById } from './activity';
import { conversationsCache, makeOptimisticConversation } from './cache';
import { conversationsQueries } from './queries';

/*
 * Every chat list puts the chat with the newest message at the top (Stay, 13
 * October 2026, the "conversation moves from top to normal position" thread).
 * The server sorts by `last_message_at` (backend 6f776f0); the client asks for
 * that order by name, and moves a chat up itself on each message it sees, so
 * a refetch puts the rows where they already are.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const read = (...parts: string[]) =>
  readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

const row = (id: string, at = '2026-10-13T10:00:00.000Z'): ConversationListItem => ({
  ...makeOptimisticConversation(id, id),
  updated_at: at,
  last_message_at: at,
});

const envelope = <T,>(rows: T[]) => ({
  success: true,
  message: '',
  data: rows,
  pagination: { current_page: 1, per_page: 20, total: rows.length, last_page: 2, from: 1, to: rows.length },
  links: { first: '', last: '', prev: null, next: null },
});

/* ── The time a row shows and sorts by ─────────────────────────────────────── */

test('a row shows and sorts by its newest message, else by updated_at on an older server', () => {
  const at = '2026-10-13T09:00:00.000Z';
  assert.equal(lastActivityAt({ updated_at: '2026-10-13T11:00:00.000Z', last_message_at: at }), at);
  assert.equal(lastActivityAt({ updated_at: at }), at, 'absent');
  assert.equal(lastActivityAt({ updated_at: at, last_message_at: null }), at, 'null');
  assert.equal(lastActivityRank({ updated_at: '', last_message_at: at }), Date.parse(at));
  assert.ok(Number.isNaN(lastActivityRank({ updated_at: 'not a date' })));
});

test('a list draws each chat once, the first copy kept', () => {
  const rows = [row('a'), row('b')];
  assert.equal(uniqueRowsById(rows), rows, 'same array when no id repeats');
  const first = row('c');
  const unique = uniqueRowsById([first, rows[0], row('c', '2026-01-01T00:00:00.000Z')]);
  assert.deepEqual(unique.map((r) => r.id), ['c', 'a']);
  assert.equal(unique[0], first);
});

/* ── The cache moves a chat on a message, and only on a message ────────────── */

test('a new message moves the chat up in the reader’s lists and its space’s chats, with its time', () => {
  const client = new QueryClient();
  const infiniteKey = [...conversationsQueries.lists(), 'infinite', {}, { viewerId: 7 }];
  const spaceKey = [...spacesQueries.contentsOf('s1'), 'conversations', {}, { viewerId: 7 }];
  client.setQueryData<InfiniteData<ConversationsListResponse>>(infiniteKey, {
    pages: [envelope([row('a'), row('b')]), envelope([row('c')])],
    pageParams: [1, 2],
  });
  client.setQueryData<InfiniteData<SpaceConversationListResponse>>(spaceKey, {
    pages: [envelope([row('x'), row('c')])],
    pageParams: [1],
  });
  const before = Date.now();
  conversationsCache.touch(client, 'c', { spaceUuid: 's1' });

  const mine = client.getQueryData<InfiniteData<ConversationsListResponse>>(infiniteKey);
  assert.deepEqual(mine?.pages.map((p) => p.data.map((r) => r.id)), [['c', 'a', 'b'], []]);
  const moved = mine!.pages[0].data[0];
  assert.ok(Date.parse(moved.last_message_at!) >= before, 'last_message_at is now');
  assert.equal(moved.updated_at, '2026-10-13T10:00:00.000Z', 'updated_at is left alone');

  const space = client.getQueryData<InfiniteData<SpaceConversationListResponse>>(spaceKey);
  assert.deepEqual(space?.pages[0].data.map((r) => r.id), ['c', 'x']);
  assert.equal(space!.pages[0].data[0].last_message_at, moved.last_message_at, 'one time for both');

  // Another space's chats, and a chat no list holds, are left as they are.
  const otherKey = [...spacesQueries.contentsOf('s2'), 'conversations', {}, { viewerId: 7 }];
  const other = { pages: [envelope([row('x'), row('c')])], pageParams: [1] };
  client.setQueryData(otherKey, other);
  conversationsCache.touch(client, 'c', { spaceUuid: 's1' });
  assert.equal(client.getQueryData(otherKey), other);
  const spaceNow = client.getQueryData(spaceKey);
  conversationsCache.touch(client, 'zz', { spaceUuid: 's1' });
  assert.equal(client.getQueryData(spaceKey), spaceNow);
  client.clear();
});

test('a rename and a visibility change patch the row where it sits', () => {
  const client = new QueryClient();
  const flatKey = [...conversationsQueries.lists(), { per_page: 10 }, { viewerId: 7 }];
  client.setQueryData(flatKey, envelope([row('a'), row('b'), row('c')]));
  conversationsCache.patch(client, 'c', { title: 'Renamed' });
  conversationsCache.setVisibility(client, 'c', true);
  const flat = client.getQueryData<ConversationsListResponse>(flatKey);
  assert.deepEqual(flat?.data.map((r) => r.id), ['a', 'b', 'c']);
  assert.equal(flat?.data[2].title, 'Renamed');
  assert.equal(flat?.data[2].is_private, true);
  assert.equal(flat?.data[2].last_message_at, '2026-10-13T10:00:00.000Z', 'not a message');
  conversationsCache.setVisibility(client, 'c', true);
  assert.equal(client.getQueryData(flatKey), flat, 'same cache when it already matches');
  client.clear();
});

test('a new chat’s placeholder row carries its first message’s time', () => {
  const placeholder = makeOptimisticConversation('n', 'First question');
  assert.equal(placeholder.last_message_at, placeholder.created_at);
});

/* ── Every list asks the server for the same order ─────────────────────────── */

test('every chat list asks for last_message_at, newest first', () => {
  const conversations = read('v2', 'features', 'conversations', 'queries.ts');
  assert.equal(conversations.match(/sort_by: 'last_message_at',\s*sort_order: 'desc',/g)?.length, 3, 'peek, rail, list page');
  assert.doesNotMatch(conversations, /sort_by: 'updated_at'/);
  const spaces = read('v2', 'features', 'spaces', 'queries.ts');
  assert.match(spaces, /sort_by: 'last_message_at',\s*sort_order: 'desc',/, 'a space’s chats');
  assert.doesNotMatch(spaces, /sort_by: 'updated_at'/);
});

test('the rows show the newest message’s time, and the list page sorts new rows by it', () => {
  for (const path of [
    ['v2', 'features', 'conversations', 'list', 'ConversationRow.tsx'],
    ['v2', 'features', 'cases', 'detail', 'CaseChatCore.tsx'],
    ['v2', 'shell', 'designs', 'sections', 'HomeSections.tsx'],
  ]) {
    const source = read(...path);
    assert.match(source, /formatRelativeTime\(lastActivityAt\((conversation|row)\), now\)/, path.join('/'));
    assert.doesNotMatch(source, /formatRelativeTime\([a-z.]*updated_at, now\)/, path.join('/'));
  }
  const list = read('v2', 'features', 'conversations', 'list', 'ConversationsList.tsx');
  assert.match(list, /const conversationSortKey = lastActivityRank;/);
});

test('the rail, the drawer and the list page draw each chat once', () => {
  for (const shell of ['V2Sidebar.tsx', 'V2Drawer.tsx']) {
    assert.match(
      read('v2', 'shell', shell),
      /const recents = uniqueRowsById\(recentsQuery\.data\?\.pages\.flatMap\(\(page\) => page\.data\) \?\? \[\]\);/,
      shell,
    );
  }
  assert.match(
    read('v2', 'features', 'conversations', 'list', 'ConversationsList.tsx'),
    /\(\) => \(pages \? uniqueRowsById\(pages\.flatMap\(\(page\) => page\.data\)\) : NO_ROWS\),/,
  );
});

/* ── The chat screen moves its chat on each message it sees ────────────────── */

/** The source from `start` up to the first `end` after it (one handler or
 *  callback, cut at the next one). */
function block(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, end);
  return source.slice(from, to);
}

const TOUCH_WITH_CACHED_SPACE =
  /conversationsCache\.touch\(queryClient, conversationId, \{\s*spaceUuid: queryClient\.getQueryData\(detailKey\)\?\.space\?\.uuid \?\? null,\s*\}\);/;

test('a send moves its chat only once the server took it', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  const sendFn = block(engine, '  async function send(', '\n  }\n');
  // Called once, in the 2xx branch, before the stream opens.
  assert.equal(sendFn.match(/handlers\.onAccepted\?\.\(\)/g)?.length, 1);
  const accepted = block(sendFn, 'if (response.success) {', '} else {');
  assert.match(accepted, /handlers\.onAccepted\?\.\(\);[\s\S]*connectToStream\(response\.data\.execution_id\);/);
  // The engine's other turns (an attach, a recovery) never call it.
  assert.equal(engine.match(/onAccepted/g)?.length, 1);

  const controller = read('v2', 'features', 'conversations', 'conversation', 'useConversationController.ts');
  assert.match(block(controller, '    onAccepted: () => {', '    onConnected: () => {'), TOUCH_WITH_CACHED_SPACE);
});

test('a refused or failed send leaves the chat where it was', () => {
  const controller = read('v2', 'features', 'conversations', 'conversation', 'useConversationController.ts');
  // submit and Ask again move nothing themselves (the engine's onAccepted
  // does, on a 2xx), and a refusal (403, 409) moves nothing either.
  for (const [start, end] of [
    ['  const submit = useCallback(', '  const regenerate = '],
    ['  const regenerate = useCallback(', '  return {'],
    ['  const takeRefusal = useCallback(', '  const submit = useCallback('],
  ] as const) {
    assert.doesNotMatch(block(controller, start, end), /conversationsCache\.touch/, start.trim());
  }
});

test('the chat screen moves its chat up on an answer and on a turn the poll sees', () => {
  const controller = read('v2', 'features', 'conversations', 'conversation', 'useConversationController.ts');
  // An answer completing (the reader's, or a colleague's this screen followed
  // after a 409) reads the space off the cached record when it ends.
  assert.match(block(controller, '    onCompleted: () => {', '    onError: '), TOUCH_WITH_CACHED_SPACE);
  // The poll moves it once per new turn (a colleague's question or answer),
  // never on its first read.
  assert.match(
    controller,
    /const changed = previous !== null && turnChanged\(previous, statusData\);\s*if \(changed\) conversationsCache\.touch\(queryClient, conversationId, \{ spaceUuid \}\);/,
  );
  // Nothing else in the screen moves a chat: accepted, completed, the poll.
  assert.equal(controller.match(/conversationsCache\.touch\(/g)?.length, 3);
});

test('the case page’s own chats ask for the same order', () => {
  assert.match(
    read('v2', 'features', 'cases', 'queries.ts'),
    /listContentConversations\('case', slug, \{\s*per_page: 5,[^}]*sort_by: 'last_message_at',\s*sort_order: 'desc',\s*\}\)/,
  );
});

test('sharing a chat patches the lists without moving it', () => {
  const share = read('v2', 'features', 'conversations', 'conversation', 'ConversationShare.tsx');
  assert.match(share, /conversationsCache\.setVisibility\(queryClient, conversationId, isPrivate\);/);
  assert.doesNotMatch(share, /conversationsCache\.touch/);
});
