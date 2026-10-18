import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { spacesQueries } from './queries';

/* Channels and threads in a space's All and Conversations pills (Stay, 17
 * October 2026, approved 15:46 UTC): the space's channels and the threads the
 * reader follows, for a reader who has team channels, in a team space. The
 * feed adds them only when asked (`include=channels,threads`, backend's
 * contract), so a reader who does not have them, and the live app before this,
 * get the feed they always did. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const paramsOf = (options: Parameters<typeof spacesQueries.items>[1]) =>
  spacesQueries.items('s-1', options).queryKey[4];

test('rooms are asked for on All and Conversations only, and only when they show', () => {
  assert.equal(paramsOf({ viewerId: 7, rooms: true }).include, 'channels,threads');
  assert.equal(paramsOf({ viewerId: 7, type: 'conversations', rooms: true }).include, 'channels,threads');
  // Files and Folders hold no rooms, so they keep their own entry.
  assert.equal(paramsOf({ viewerId: 7, type: 'files', rooms: true }).include, undefined);
  assert.equal(paramsOf({ viewerId: 7, type: 'folders', rooms: true }).include, undefined);
  // A reader without them asks for nothing new: today's cache entry.
  assert.equal(paramsOf({ viewerId: 7 }).include, undefined);
  assert.deepEqual(paramsOf({ viewerId: 7 }), { per_page: 20 });
  // The include is part of the key, so the two answers never share an entry.
  assert.notDeepEqual(
    spacesQueries.items('s-1', { viewerId: 7, rooms: true }).queryKey,
    spacesQueries.items('s-1', { viewerId: 7 }).queryKey,
  );
});

test('the call sends include, and the feed rows carry the two room kinds', () => {
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /include: params\.include \|\| undefined,/);
  const types = read('types', 'collab.ts');
  assert.match(types, /\| \{ type: 'channel'; sort_at: string; item: Channel \}/);
  assert.match(types, /\| \{ type: 'thread'; sort_at: string; item: Channel \};/);
  assert.match(types, /export type SpaceItemsInclude = 'channels,threads';/);
});

test('the home asks for rooms by the rail’s own rule, and draws them in the feed’s one row', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /const rooms = spaceShowsChannels\(space, session\);/);
  // No search since 17 October 2026 (Stay 19:11 UTC, Arthur 22:31 UTC).
  assert.match(panel, /spacesQueries\.items\(space\.uuid, \{ viewerId, type, rooms \}\)/);
  assert.doesNotMatch(panel, /placeholder:|SearchField/);
  // Rows are told apart by uuid, as their lists do.
  assert.match(panel, /entry\.type === 'folder' \|\| entry\.type === 'channel' \|\| entry\.type === 'thread'/);
  // The rail's unread grammar, so a muted room goes quiet and its @you stays
  // loud in the right column.
  const rows = read('v2', 'features', 'spaces', 'detail', 'content', 'feed-rows.tsx');
  assert.equal(rows.match(/const grammar = channelUnreadGrammar\((channel|thread)\);/g)?.length, 2);
  assert.match(rows, /const state = threadUnreadState\(thread\);/);
  assert.match(rows, /quiet: grammar\.muted,/);
  assert.match(rows, /const behind = state === 'behind' && !grammar\.muted;/);
  // A room's menu lives in the room: its rows carry a count, never a menu.
  const rooms = rows.slice(rows.indexOf("case 'channel': {"));
  assert.doesNotMatch(rooms, /menu:/);
  assert.equal(rooms.match(/mentions: grammar\.mentions,/g)?.length, 2);
});

test('no row has a menu column, so rows end at one edge (Stay, 18 October 2026)', () => {
  const rows = read('v2', 'features', 'spaces', 'detail', 'content', 'feed-rows.tsx');
  // A chat's and a folder's actions are in their page's ⋮, a file's in its
  // card's; every row's time and count end at the same edge.
  assert.match(rows, /<li className="flex min-w-0">\{render\(BODY, content\)\}<\/li>/);
  assert.doesNotMatch(rows, /line\.menu|SpaceFileMenu/);
  assert.doesNotMatch(rows, /FolderActionsMenu|ConversationRowMenu/);
  // A thread's status: the dot and the word, after its name.
  assert.match(rows, /<ThreadStatusDot value=\{status\.value\} \/>\s*<span className="truncate">\{threadStatusLabel\(status\.value\)\}<\/span>/);
  assert.match(rows, /status: <ThreadStatus thread=\{thread\} \/>,/);
  // The lobby keeps its own rows, with no feed layout left in them.
  for (const file of ['SpaceChannelRow.tsx', 'SpaceThreadRow.tsx']) {
    const row = read('v2', 'features', 'spaces', 'detail', file);
    assert.doesNotMatch(row, /layout|menuColumn/, file);
    assert.match(row, /return <li>\{link\}<\/li>;/, file);
  }
  const channel = read('v2', 'features', 'spaces', 'detail', 'SpaceChannelRow.tsx');
  assert.match(channel, /\{preview \? \(\s*<span className="min-w-0 truncate">\s*<ChannelPreviewText line=\{preview\} \/>/);
  const thread = read('v2', 'features', 'spaces', 'detail', 'SpaceThreadRow.tsx');
  assert.equal(thread.match(/\? noMessages : null/g)?.length, 2);
});

test('a new message in a room re-reads that space’s feed, which is never written', () => {
  const spine = read('v2', 'runtime', 'realtime', 'spine.tsx');
  assert.match(spine, /void queryClient\.invalidateQueries\(\{ queryKey: spacesQueries\.itemsOf\(event\.space_uuid\) \}\);/);
});
