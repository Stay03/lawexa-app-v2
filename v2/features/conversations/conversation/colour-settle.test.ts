import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient } from '@tanstack/react-query';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { makeOptimisticConversation, spaceOfListedChat } from '../cache';
import { conversationsQueries } from '../queries';

/*
 * A space chat's colours settle once (techlead, 14 October 2026, on
 * fade-before-cr0's grey bubbles). The roster that colours the askers loads
 * beside the chat's record, its space read off the lists already cached, and
 * a colour that still lands late eases in. A desktop chat's bar matches the
 * chats list page's: no category label.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const read = (...parts: string[]) =>
  readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

const envelope = <T,>(rows: T[]) => ({
  success: true,
  message: '',
  data: rows,
  pagination: { current_page: 1, per_page: 20, total: rows.length, last_page: 1, from: 1, to: rows.length },
  links: { first: '', last: '', prev: null, next: null },
});

test('a chat’s space is read off the lists cached on this device', () => {
  const client = new QueryClient();
  const inSpace = { ...makeOptimisticConversation('a', 'a'), space: { uuid: 's1', name: 'B4 Chambers' } };
  const personal = makeOptimisticConversation('b', 'b');
  client.setQueryData([...conversationsQueries.lists(), 'infinite', {}, { viewerId: 7 }], {
    pages: [envelope([inSpace, personal])],
    pageParams: [1],
  });
  // A colleague's chat, only in the space's feed (design B4): named by the
  // feed's key. The feed's pages mix kinds; a folder or a file is not a chat.
  const feedPage = (data: unknown[]) => ({
    success: true,
    message: '',
    data,
    pagination: { per_page: 20, has_more: false, next_cursor: null, prev_cursor: null },
  });
  client.setQueryData(spacesQueries.items('s2', { viewerId: 7 }).queryKey, {
    pages: [
      feedPage([
        { type: 'folder', sort_at: '2026-10-17T09:00:00Z', item: { uuid: 'd' } },
        { type: 'conversation', sort_at: '2026-10-17T08:00:00Z', item: makeOptimisticConversation('c', 'c') },
      ]),
    ],
    pageParams: [null],
  } as never);
  assert.equal(spaceOfListedChat(client, 'a'), 's1');
  assert.equal(spaceOfListedChat(client, 'b'), null, 'a personal chat');
  assert.equal(spaceOfListedChat(client, 'c'), 's2');
  assert.equal(spaceOfListedChat(client, 'd'), null, 'not a chat');
  assert.equal(spaceOfListedChat(client, 'zz'), null, 'not cached');
  // The reader's list may not name a chat's space; the space's own list still does.
  client.setQueryData([...conversationsQueries.lists(), { per_page: 10 }, { viewerId: 7 }], envelope([makeOptimisticConversation('c', 'c')]));
  assert.equal(spaceOfListedChat(client, 'c'), 's2');
  client.clear();
});

test('the roster loads beside the record, on the lists’ word until the record answers', () => {
  const controller = read('v2', 'features', 'conversations', 'conversation', 'useConversationController.ts');
  assert.match(controller, /const listedSpace = useMemo\(\(\) => spaceOfListedChat\(queryClient, conversationId\), \[queryClient, conversationId\]\);/);
  assert.match(controller, /const spaceUuid = detailData \? \(detailData\.space\?\.uuid \?\? null\) : listedSpace;/);
  assert.match(controller, /enabled: spaceUuid !== null && \(detailData === null \|\| showAuthors\),/);
  // The colours themselves still wait for the record's word that it shows authors.
  assert.match(controller, /showAuthors && rosterRows/);
});

test('a colour that lands late eases in', () => {
  const row = read('v2', 'features', 'conversations', 'conversation', 'rows', 'UserMessageRow.tsx');
  assert.match(row, /const COLOUR_EASE = 'transition-colors duration-300 motion-reduce:transition-none';/);
  assert.match(row, /plain: cn\('bg-muted', COLOUR_EASE\),/);
  assert.match(row, /member: cn\('bg-\[var\(--member-bg\)\] dark:bg-\[var\(--member-bg-dark\)\]', COLOUR_EASE\),/);
});

test('a chat’s desktop bar carries no category label, as the chats list page', () => {
  const header = read('v2', 'shell', 'V2Header.tsx');
  assert.match(header, /const leftLabel = isHome \? 'Home' : isCase \? 'Case' : null;/);
  assert.doesNotMatch(header, /'Conversation'/);
});
