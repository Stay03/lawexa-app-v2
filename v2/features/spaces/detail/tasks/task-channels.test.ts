import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { InfiniteData } from '@tanstack/react-query';
import type { Channel, SpaceTask, SpaceTaskListResponse, SpaceTaskMove } from '@/types/collab';
import { readTaskPages } from '../../task-pages';
import {
  boardChannelOptions,
  channelLabel,
  newTaskChannel,
  roomChannel,
  starterChannel,
} from './task-board-model';
import { startThreadChannel } from './task-box-model';
import {
  activeBoardChannel,
  doneCount,
  doneHeadCount,
  dropDoneTask,
  mergeBoard,
  NO_CHANNEL,
  placeDoneTask,
  placeTask,
  taskInChannel,
} from './task-cache';
import { createPayload, draftFromTask, moveLine, serverFieldErrors, updatePayload } from './task-sheet-model';

/* Every card belongs to a channel (Arthur's yes, thread 550bf0ab; Backend's
 * task-cards 0bc04772): the board filters by channel, each card names its
 * channel, New task and the task box pick one, and the history says when a
 * card moved between channels. Done comes a page at a time. */

const GENERAL = { uuid: 'c-general', name: 'general' };
const PRODUCT = { uuid: 'c-product', name: 'product' };

function task(uuid: string, overrides: Partial<SpaceTask> = {}): SpaceTask {
  return {
    uuid,
    title: `Task ${uuid}`,
    stage: 'queued',
    stage_note: null,
    waiting_on: null,
    owner: null,
    thread: null,
    channel: GENERAL,
    position: 0,
    started_at: null,
    stage_changed_at: '2026-11-02T10:00:00Z',
    stage_changed_by: null,
    via: 'app',
    created_at: '2026-11-01T10:00:00Z',
    created_by: null,
    updated_at: '2026-11-02T10:00:00Z',
    ...overrides,
  };
}

function donePages(...pages: SpaceTask[][]): InfiniteData<SpaceTaskListResponse> {
  return {
    pageParams: pages.map((_, index) => index + 1),
    pages: pages.map((data, index) => ({
      success: true,
      message: '',
      data,
      pagination: { current_page: index + 1, per_page: 20, total: 0, last_page: pages.length, from: null, to: null },
      links: { first: null, last: null, prev: null, next: null },
    })) as unknown as SpaceTaskListResponse[],
  };
}

function room(uuid: string, overrides: Partial<Channel> = {}): Channel {
  return {
    uuid,
    name: uuid,
    is_thread: false,
    visibility: 'space_public',
    is_member: false,
    created_at: '2026-10-01T00:00:00Z',
    parent_channel_uuid: null,
    ...overrides,
  } as Channel;
}

test('the channel filter shows every card, one channel’s, or the cards with no channel', () => {
  assert.equal(taskInChannel(task('a'), null), true);
  assert.equal(taskInChannel(task('a'), GENERAL.uuid), true);
  assert.equal(taskInChannel(task('a'), PRODUCT.uuid), false);
  assert.equal(taskInChannel(task('a', { channel: null }), NO_CHANNEL), true);
  assert.equal(taskInChannel(task('a'), NO_CHANNEL), false);
  // A server before channels sends no field: such a card has no channel.
  assert.equal(taskInChannel({}, NO_CHANNEL), true);
});

test('a write lands in the open reads whose channel the card is in, and leaves the others', () => {
  const moved = task('a', { channel: PRODUCT });
  assert.deepEqual(placeTask([task('a'), task('b')], moved, PRODUCT.uuid).map((row) => row.uuid), ['a', 'b']);
  assert.deepEqual(placeTask([task('a'), task('b')], moved, GENERAL.uuid).map((row) => row.uuid), ['b']);
  assert.deepEqual(placeTask([task('b')], moved, null).map((row) => row.uuid), ['b', 'a']);
});

test('a done read keeps a card only while it is done and in its channel, and never takes a late copy', () => {
  const done = task('a', { stage: 'done' });
  const data = donePages([done, task('b', { stage: 'done' })], [task('c', { stage: 'done' })]);
  // Back to Working: off the done read.
  assert.deepEqual(
    placeDoneTask(data, task('a', { stage: 'working', updated_at: '2026-11-02T11:00:00Z' }), null).pages[0].data.map((row) => row.uuid),
    ['b'],
  );
  // Moved to another channel: off this channel's done read.
  assert.deepEqual(
    placeDoneTask(data, task('c', { stage: 'done', channel: PRODUCT }), GENERAL.uuid).pages[1].data.map((row) => row.uuid),
    [],
  );
  // A newer copy replaces it; an older one does not.
  const renamed = task('a', { stage: 'done', title: 'Renamed', updated_at: '2026-11-02T11:00:00Z' });
  assert.equal(placeDoneTask(data, renamed, null).pages[0].data[0].title, 'Renamed');
  const late = task('a', { stage: 'done', title: 'Late', updated_at: '2026-11-02T09:00:00Z' });
  assert.equal(placeDoneTask(data, late, null).pages[0].data[0].title, 'Task a');
  assert.deepEqual(dropDoneTask(data, 'c').pages[1].data, []);
});

test('the board joins open and done cards, each once, the newer copy winning', () => {
  const doneCopy = task('a', { stage: 'done', updated_at: '2026-11-02T10:00:00Z' });
  const reopened = task('a', { stage: 'working', updated_at: '2026-11-02T11:00:00Z' });
  assert.deepEqual(mergeBoard([reopened], [doneCopy]), [reopened]);
  // Just moved to Done on this board: the open read's newer copy shows it there at once.
  const justDone = task('b', { stage: 'done', updated_at: '2026-11-02T12:00:00Z' });
  assert.deepEqual(mergeBoard([justDone], [task('b', { stage: 'done' })]), [justDone]);
  // A tie goes to the open read, where writes land.
  const tie = task('c', { title: 'Open copy' });
  assert.equal(mergeBoard([tie], [task('c', { stage: 'done' })])[0].title, 'Open copy');
  assert.equal(mergeBoard([task('d')], [task('e', { stage: 'done' })]).length, 2);
});

test('Done counts the server’s total, or the cards shown when the board already has more', () => {
  assert.equal(doneCount(20, 57), 57);
  assert.equal(doneCount(21, 20), 21);
  assert.equal(doneCount(3, null), 3);
});

test('the filter and the Channel field offer the readable top-level channels, by name', () => {
  const rooms = [
    room('c-zeta', { name: 'zeta' }),
    room('c-alpha', { name: 'alpha' }),
    room('c-secret', { name: 'secret', visibility: 'private' as Channel['visibility'] }),
    room('c-mine', { name: 'mine', visibility: 'private' as Channel['visibility'], is_member: true }),
    room('t-1', { name: 'a thread', is_thread: true, parent_channel_uuid: 'c-alpha' }),
  ];
  assert.deepEqual(boardChannelOptions(rooms).map((option) => option.name), ['alpha', 'mine', 'zeta']);
  // A card's own channel stays a choice when the list has not got it.
  assert.deepEqual(boardChannelOptions(rooms, PRODUCT).map((option) => option.name), ['alpha', 'mine', 'product', 'zeta']);
  assert.equal(channelLabel(PRODUCT), '#product');
});

test('a new card starts in its thread’s channel, else the filter’s, else the starter channel', () => {
  const rooms = [
    room('c-new', { created_at: '2026-10-05T00:00:00Z' }),
    room('c-old', { created_at: '2026-10-01T00:00:00Z' }),
    room('c-older-private', { created_at: '2026-09-01T00:00:00Z', visibility: 'private' as Channel['visibility'], is_member: true }),
    room('t-1', { is_thread: true, parent_channel_uuid: 'c-new' }),
  ];
  // The server's starter: the oldest channel open to the whole Space.
  assert.equal(starterChannel(rooms), 'c-old');
  assert.equal(roomChannel(rooms, 't-1'), 'c-new');
  assert.equal(roomChannel(rooms, 'c-old'), 'c-old');
  assert.equal(roomChannel(rooms, 'missing'), null);
  assert.equal(newTaskChannel({ threadChannel: 'c-new', filter: 'c-product', starter: 'c-old' }), 'c-new');
  assert.equal(newTaskChannel({ threadChannel: null, filter: 'c-product', starter: 'c-old' }), 'c-product');
  // "No channel" is a filter, not a channel to put a card in.
  assert.equal(newTaskChannel({ threadChannel: null, filter: NO_CHANNEL, starter: 'c-old' }), 'c-old');
  assert.equal(newTaskChannel({ threadChannel: null, filter: null, starter: null }), null);
});

test('New task sends its channel; a change sends a new channel and never takes one away', () => {
  const draft = { ...draftFromTask(null, 'u-me'), title: 'Write the brief', channel: PRODUCT.uuid };
  assert.deepEqual(createPayload(draft), { title: 'Write the brief', stage: 'queued', owner: 'u-me', channel: PRODUCT.uuid });
  const saved = task('a');
  assert.equal(draftFromTask(saved, null).channel, GENERAL.uuid);
  assert.deepEqual(updatePayload({ ...draftFromTask(saved, null), channel: PRODUCT.uuid }, saved), { channel: PRODUCT.uuid });
  assert.equal(updatePayload(draftFromTask(saved, null), saved), null);
  assert.equal(updatePayload({ ...draftFromTask(saved, null), channel: null }, task('a')), null);
});

test('a refused channel change shows the server’s sentence under the Channel field', () => {
  assert.deepEqual(serverFieldErrors({ channel: ['A card is in the channel of its thread.'] }), {
    channel: 'A card is in the channel of its thread.',
  });
});

test('the history says when a card moved between channels', () => {
  const move = (overrides: Partial<SpaceTaskMove>): SpaceTaskMove => ({
    from: 'queued',
    to: 'queued',
    from_owner: null,
    to_owner: null,
    note: null,
    by: { uuid: 'u-stay', name: 'Stay', username: null, avatar_url: null, is_agent: false },
    via: 'app',
    at: '2026-11-02T10:00:00Z',
    waiting_on: null,
    from_channel: null,
    to_channel: null,
    ...overrides,
  });
  assert.equal(moveLine(move({ from_channel: GENERAL, to_channel: PRODUCT })), 'Stay moved it from #general to #product');
  // The server leaves a channel the reader cannot open unnamed.
  assert.equal(moveLine(move({ to_channel: PRODUCT })), 'Stay moved it to #product');
  assert.equal(moveLine(move({ from_channel: GENERAL })), 'Stay moved it out of #general');
  assert.equal(
    moveLine(move({ to: 'working', from_channel: GENERAL, to_channel: PRODUCT })),
    'Stay moved it from Queued to Working and moved it from #general to #product',
  );
  assert.equal(moveLine(move({})), 'Stay changed it in Queued');
});

test('the open read takes every page in turn, each card once, and one page when the board is empty', async () => {
  const page = (current: number, last: number, cards: SpaceTask[]): SpaceTaskListResponse =>
    ({
      success: true,
      message: '',
      data: cards,
      pagination: { current_page: current, per_page: 100, total: 0, last_page: last, from: null, to: null },
      links: { first: null, last: null, prev: null, next: null },
    }) as unknown as SpaceTaskListResponse;
  const asked: number[] = [];
  const pages: Record<number, SpaceTaskListResponse> = {
    1: page(1, 3, [task('a'), task('b')]),
    // A card moved between two reads comes on two pages: it shows once.
    2: page(2, 3, [task('b'), task('c')]),
    3: page(3, 3, [task('d')]),
  };
  const rows = await readTaskPages(async (n) => {
    asked.push(n);
    return pages[n];
  });
  assert.deepEqual(asked, [1, 2, 3]);
  assert.deepEqual(rows.map((row) => row.uuid), ['a', 'b', 'c', 'd']);
  // An empty board answers last_page 0 on page 1: one read, no cards.
  const emptyAsked: number[] = [];
  const none = await readTaskPages(async (n) => {
    emptyAsked.push(n);
    return page(1, 0, []);
  });
  assert.deepEqual(emptyAsked, [1]);
  assert.deepEqual(none, []);
});

test('"No channel" changes a card it has but never takes one in, since an unreadable channel also comes as none', () => {
  const shown = task('a', { channel: null });
  const changed = task('a', { channel: null, title: 'Renamed' });
  assert.equal(placeTask([shown], changed, NO_CHANNEL)[0].title, 'Renamed');
  // A card the viewer cannot place: not added to "No channel", left to the next read.
  assert.deepEqual(placeTask([shown], task('z', { channel: null }), NO_CHANNEL).map((row) => row.uuid), ['a']);
  // Every channel still takes it in; a card that gained a channel leaves "No channel".
  assert.deepEqual(placeTask([], task('z', { channel: null }), null).map((row) => row.uuid), ['z']);
  assert.deepEqual(placeTask([shown], task('a', { channel: PRODUCT }), NO_CHANNEL), []);
});

test('Done shows no number while it loads or after it failed, the total for everyone, and the cards shown for one owner', () => {
  const base = { pending: false, failed: false, ownerFiltered: false, shown: 20, total: 24 };
  assert.equal(doneHeadCount({ ...base, pending: true }), null);
  assert.equal(doneHeadCount({ ...base, failed: true }), null);
  assert.equal(doneHeadCount(base), 24);
  assert.equal(doneHeadCount({ ...base, ownerFiltered: true, shown: 3 }), 3);
  assert.equal(doneHeadCount({ ...base, shown: 25 }), 25);
});

test('a chosen channel the list no longer has shows every channel, never a filter the button does not name', () => {
  const options = [GENERAL, PRODUCT];
  assert.equal(activeBoardChannel(PRODUCT.uuid, options, true), PRODUCT.uuid);
  assert.equal(activeBoardChannel('c-gone', options, true), null);
  // Until the list has come, the choice stands.
  assert.equal(activeBoardChannel('c-gone', [], false), 'c-gone');
  assert.equal(activeBoardChannel(NO_CHANNEL, options, true), NO_CHANNEL);
  assert.equal(activeBoardChannel(null, options, true), null);
});

test('a task’s thread starts in the card’s own channel when the reader may post there', () => {
  const options = [GENERAL, PRODUCT];
  // The first local run offered #general for a card in #product.
  assert.equal(startThreadChannel({ picked: null, cardChannel: PRODUCT.uuid, options, preselected: GENERAL.uuid }), PRODUCT.uuid);
  assert.equal(startThreadChannel({ picked: GENERAL.uuid, cardChannel: PRODUCT.uuid, options, preselected: GENERAL.uuid }), GENERAL.uuid);
  // A channel the reader cannot post in is not offered: the list's first choice.
  assert.equal(startThreadChannel({ picked: null, cardChannel: 'c-private', options, preselected: GENERAL.uuid }), GENERAL.uuid);
  assert.equal(startThreadChannel({ picked: null, cardChannel: null, options, preselected: null }), null);
});
