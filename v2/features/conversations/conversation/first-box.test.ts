import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient } from '@tanstack/react-query';
import type { ConversationListItem } from '@/types/chat';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { listedConversation, makeOptimisticConversation } from '../cache';
import { conversationsQueries } from '../queries';

/* A chat tapped from a list draws its real message box at once (Stay, 17 October
 * 2026): the list's row says whose the chat is and whether the reader may send,
 * so the box no longer waits as a grey pill for the chat's record. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(join(here, file), 'utf8').replace(/\r\n/g, '\n');

const row = (id: string, userId: number, canSend?: boolean): ConversationListItem =>
  ({
    ...makeOptimisticConversation(id, 'A lease question'),
    user_id: userId,
    ...(canSend !== undefined && { can_send: canSend }),
  }) as ConversationListItem;

const page = (rows: ConversationListItem[]) => ({
  success: true,
  data: rows,
  pagination: { current_page: 1, last_page: 1, total: rows.length, per_page: 20 },
});

test('the row of the reader\'s own recents says whose the chat is and whether they may send', () => {
  const client = new QueryClient();
  client.setQueryData(conversationsQueries.infiniteRecents({ viewerId: 7 }).queryKey, {
    pages: [page([row('c-1', 7, true)])],
    pageParams: [1],
  } as never);
  const found = listedConversation(client, 'c-1');
  assert.equal(found?.user_id, 7);
  assert.equal(found?.can_send, true);
  assert.equal(listedConversation(client, 'c-2'), null);
  client.clear();
});

test('a space chat is found on its space\'s chats list, a viewer\'s row saying they may not send', () => {
  const client = new QueryClient();
  client.setQueryData(spacesQueries.conversations('s-1', { viewerId: 7 }).queryKey, {
    pages: [page([row('c-9', 3, false)])],
    pageParams: [1],
  } as never);
  const found = listedConversation(client, 'c-9');
  assert.equal(found?.user_id, 3);
  assert.equal(found?.can_send, false);
  client.clear();
});

test('the create flow\'s placeholder row (owner 0) says nothing', () => {
  const client = new QueryClient();
  client.setQueryData(conversationsQueries.infiniteRecents({ viewerId: 7 }).queryKey, {
    pages: [page([makeOptimisticConversation('c-new', 'Just asked')])],
    pageParams: [1],
  } as never);
  assert.equal(listedConversation(client, 'c-new'), null);
  client.clear();
});

test('the screen draws the real box once the owner is known, and holds Send while the history loads', () => {
  const controller = read('useConversationController.ts');
  assert.match(controller, /const ownerId = detailData\?\.user_id \?\? localOwnerId \?\? listedRow\?\.user_id \?\? null;/);
  assert.match(controller, /const canSend = detailData \? canSendIn\(detailData, isOwner\) : \(listedRow\?\.can_send \?\? isOwner\);/);
  const screen = read('ConversationScreen.tsx');
  // The skeleton only while the owner is unknown (a cold open with no list behind it).
  assert.match(screen, /\{!controller\.isOwnerResolved \? \(/);
  assert.match(screen, /holdingSkeleton \? null : <ComposerSkeleton \/>/);
  // The history no longer keeps the box grey; it holds Send instead.
  assert.doesNotMatch(screen, /!controller\.isOwnerResolved \|\| isLoadingHistory/);
  assert.match(screen, /<ConversationComposer\s+disabled=\{isLoadingHistory\}/);
});
