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

test('the home asks for rooms by the rail’s own rule, and draws them with the lobby’s rows', () => {
  const panel = read('v2', 'features', 'spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /const rooms = spaceShowsChannels\(space, session\);/);
  assert.match(panel, /spacesQueries\.items\(space\.uuid, \{ viewerId, type, search: search\.term, rooms \}\)/);
  // The rail's unread grammar, so a muted room sinks and its @you stays loud.
  assert.match(
    panel,
    /<SpaceChannelRow\s+key=\{itemKey\(entry\)\}\s+row=\{\{ channel: entry\.item, grammar: channelUnreadGrammar\(entry\.item\), preview: entry\.item\.last_message \}\}/,
  );
  assert.match(panel, /grammar: channelUnreadGrammar\(entry\.item\),\s*state: threadUnreadState\(entry\.item\),/);
  assert.equal(panel.match(/layout="feed"/g)?.length, 3, 'folders, channels and threads');
  // A room's menu lives in the room.
  assert.match(panel, /case 'channel':\s*case 'thread':\s*\/\/[^\n]*\n\s*return false;/);
  // Rows are told apart by uuid, as their lists do.
  assert.match(panel, /entry\.type === 'folder' \|\| entry\.type === 'channel' \|\| entry\.type === 'thread'/);
});

test('in the feed the room rows take the conversation row’s box and keep the menu column', () => {
  for (const file of ['SpaceChannelRow.tsx', 'SpaceThreadRow.tsx']) {
    const row = read('v2', 'features', 'spaces', 'detail', file);
    assert.match(row, /layout = 'list',\s*menuColumn = false,/, file);
    assert.match(row, /feed \? 'min-h-14 flex-1 items-center' : 'items-start',/, file);
    assert.match(row, /feed \? 'text-sm' : 'text-\[15px\]',/, file);
    assert.match(row, /\{menuColumn \? <span aria-hidden className="size-9 shrink-0" \/> : null\}/, file);
    // The lobby keeps its own row.
    assert.match(row, /\) : \(\s*<li>\{link\}<\/li>\s*\);/, file);
  }
  // The channel's second line: no top margin in the feed (rows 56px, not 58),
  // and no empty preview span before the status counts (they lead the line).
  const channel = read('v2', 'features', 'spaces', 'detail', 'SpaceChannelRow.tsx');
  assert.match(channel, /'flex min-w-0 items-baseline gap-1 text-xs text-muted-foreground',\s*!feed && 'mt-0\.5',/);
  assert.match(channel, /\{preview \? \(\s*<span className="min-w-0 truncate">\s*<ChannelPreviewText line=\{preview\} \/>/);
  // A thread's status chip leads the second line on a phone, so the title
  // has the whole row (techlead, 17 October 2026); from md: up it stays by
  // the title. The pill overlaps its 16px line, so the row stays 56px.
  const thread = read('v2', 'features', 'spaces', 'detail', 'SpaceThreadRow.tsx');
  assert.match(thread, /className=\{feed \? 'max-md:hidden' : undefined\}/);
  assert.match(thread, /\{feed && status \? \(\s*<div className="flex min-w-0 items-center gap-2">\s*<ThreadStatusChip[^>]*className="-my-0\.5 md:hidden"\s*\/>\s*\{meta\}/);
});

test('a new message in a room re-reads that space’s feed, which is never written', () => {
  const spine = read('v2', 'runtime', 'realtime', 'spine.tsx');
  assert.match(spine, /void queryClient\.invalidateQueries\(\{ queryKey: spacesQueries\.itemsOf\(event\.space_uuid\) \}\);/);
});
