import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Channel, SpaceTask } from '@/types/collab';
import {
  cardClickRenames,
  initialPhoneTab,
  renameOutcome,
  startThreadChannels,
  startThreadError,
  startThreadPayload,
  taskChatLine,
  taskChatState,
  taskThreadAccess,
  type ThreadAccess,
} from './task-box-model';

/* The task box's chat pane (Arthur's 1 + 2, thread 7aa0c6d8; design 1805492d).
 * TEST DATA throughout. */

const THREAD = { uuid: 'thread-uuid-1', name: 'TEST DATA lease review', channel_uuid: 'channel-uuid-1' };

function task(thread: SpaceTask['thread']): SpaceTask {
  return {
    uuid: 'task-uuid-1',
    title: 'Draft the TEST DATA lease review',
    stage: 'working',
    stage_note: null,
    waiting_on: null,
    owner: null,
    thread,
    position: 0,
    started_at: null,
    stage_changed_at: '2026-10-30T20:00:00Z',
    stage_changed_by: null,
    via: 'app',
    created_at: '2026-10-30T20:00:00Z',
    created_by: null,
    updated_at: '2026-10-30T20:00:00Z',
  };
}

const PENDING: ThreadAccess = { status: 'pending' };
const access = (canRead: boolean, canPost: boolean): ThreadAccess => ({ status: 'read', canRead, canPost });

test('task chat is for Researchers (Stay’s A): anyone else gets a line saying why, and nothing is asked', () => {
  for (const subject of [null, task(null), task(THREAD)]) {
    const state = taskChatState(subject, { canEdit: true, canChat: false }, access(true, true));
    assert.equal(state.kind, 'closed');
    assert.equal(taskChatLine(state), 'Task chat is for Researchers, so it isn’t open to you.');
  }
});

test('a new task has nothing to chat about yet', () => {
  const state = taskChatState(null, { canEdit: true, canChat: true }, PENDING);
  assert.equal(state.kind, 'new');
  assert.equal(taskChatLine(state), 'Save the task first to chat about it.');
});

test('a task with no thread offers Start a thread only to those who may edit it', () => {
  assert.deepEqual(taskChatState(task(null), { canEdit: true, canChat: true }, PENDING), { kind: 'none', canStart: true });
  assert.deepEqual(taskChatState(task(null), { canEdit: false, canChat: true }, PENDING), { kind: 'none', canStart: false });
  assert.equal(taskChatLine(taskChatState(task(null), { canEdit: true, canChat: true }, PENDING)), 'No chat for this task yet.');
});

test('the thread’s own answer decides the pane, not the board role', () => {
  assert.equal(taskChatState(task(THREAD), { canEdit: true, canChat: true }, PENDING).kind, 'loading');
  // Not readable: a 403 (no researcher role) or can_read false, whatever the board role.
  for (const canEdit of [true, false]) {
    for (const answer of [{ status: 'forbidden' } as const, access(false, false)]) {
      const hidden = taskChatState(task(THREAD), { canEdit: canEdit, canChat: true }, answer);
      assert.equal(hidden.kind, 'hidden');
      assert.equal(taskChatLine(hidden), 'You can’t see this task’s thread.');
    }
  }
  // Readable, not in the channel: the messages and Join to reply.
  assert.equal(taskChatState(task(THREAD), { canEdit: true, canChat: true }, access(true, false)).kind, 'read');
  // In the channel: the composer, for a board Viewer too (as on the thread's own page).
  const post = taskChatState(task(THREAD), { canEdit: false, canChat: true }, access(true, true));
  assert.equal(post.kind, 'post');
  assert.equal(post.kind === 'post' && post.thread.uuid, 'thread-uuid-1');
  assert.equal(taskChatLine(post), null);
  // Any other failure is worth a retry.
  const failed = taskChatState(task(THREAD), { canEdit: true, canChat: true }, { status: 'failed' });
  assert.equal(taskChatLine(failed), 'The chat didn’t load.');
});

test('the thread query reads as an answer: flags, a 403, another failure, or still on its way', () => {
  assert.deepEqual(taskThreadAccess({ isPending: true, errorStatus: null }), { status: 'pending' });
  assert.deepEqual(taskThreadAccess({ isPending: false, data: { can_read: true, can_post: false }, errorStatus: null }), access(true, false));
  // As on the thread's own page, only a true opens: a row with no flags is closed.
  assert.deepEqual(taskThreadAccess({ isPending: false, data: {}, errorStatus: null }), access(false, false));
  assert.deepEqual(taskThreadAccess({ isPending: false, errorStatus: 403 }), { status: 'forbidden' });
  assert.deepEqual(taskThreadAccess({ isPending: false, errorStatus: 500 }), { status: 'failed' });
  assert.deepEqual(taskThreadAccess({ isPending: false, errorStatus: null }), { status: 'failed' });
});

test('a phone opens on the details, or on the chat when opened to reply; a new task always on the details', () => {
  assert.equal(initialPhoneTab(task(THREAD), null), 'details');
  assert.equal(initialPhoneTab(task(THREAD), 'details'), 'details');
  assert.equal(initialPhoneTab(task(THREAD), 'chat'), 'chat');
  assert.equal(initialPhoneTab(null, 'chat'), 'details');
});

test('a click on the title renames on a computer, for an editor; Enter, a phone, a viewer or the rest of the card opens the box', () => {
  const click = { canEdit: true, computer: true, onTitle: true, detail: 1 };
  assert.equal(cardClickRenames(click), true);
  // Enter or Space on a focused card is a keyboard click: it opens the box (the drag plan's pin).
  assert.equal(cardClickRenames({ ...click, detail: 0 }), false);
  // A phone renames in the box only: there a press and hold is the drag.
  assert.equal(cardClickRenames({ ...click, computer: false }), false);
  assert.equal(cardClickRenames({ ...click, canEdit: false }), false);
  assert.equal(cardClickRenames({ ...click, onTitle: false }), false);
});

test('a typed title sends only a real change: trimmed, never empty, never over the limit', () => {
  const card = task(null);
  assert.deepEqual(renameOutcome(card, 'Draft the TEST DATA lease review', 200), { kind: 'unchanged' });
  assert.deepEqual(renameOutcome(card, '  Draft the TEST DATA lease review  ', 200), { kind: 'unchanged' });
  assert.deepEqual(renameOutcome(card, '   ', 200), { kind: 'invalid', message: 'A task needs a title.' });
  assert.deepEqual(renameOutcome(card, 'x'.repeat(201), 200), { kind: 'invalid', message: 'A title is at most 200 characters.' });
  const save = renameOutcome(card, ' Draft the TEST DATA lease review (v2) ', 200);
  assert.equal(save.kind, 'save');
  assert.deepEqual(save.kind === 'save' && save.payload, { title: 'Draft the TEST DATA lease review (v2)' });
  // The card shows the new title at once; nothing else about it changes.
  assert.deepEqual(save.kind === 'save' && save.shown, { ...card, title: 'Draft the TEST DATA lease review (v2)' });
});

/* Start a thread in a picked channel (Stay, 30 October 2026, 22:40Z; Backend 45842ebc). */

function room(uuid: string, name: string, createdAt: string, extra: Partial<Channel> = {}): Channel {
  return { uuid, name, created_at: createdAt, is_thread: false, visibility: 'space_public', ...extra } as Channel;
}

test('the channels a thread may start in: open, top-level, once each, in name order, the oldest preselected', () => {
  const rooms = [
    room('c-research', 'research', '2026-10-30T12:00:00Z'),
    room('c-private', 'partners', '2026-10-01T09:00:00Z', { visibility: 'private' }),
    room('c-thread', 'thread--x', '2026-09-01T09:00:00Z', { is_thread: true }),
    room('c-general', 'general', '2026-10-02T09:00:00Z'),
    room('c-research', 'research', '2026-10-30T12:00:00Z'),
  ];
  assert.deepEqual(startThreadChannels(rooms), {
    options: [
      { uuid: 'c-general', name: 'general' },
      { uuid: 'c-research', name: 'research' },
    ],
    preselected: 'c-general',
  });
  // The default is the oldest by its own date, whatever order the list came in.
  assert.equal(startThreadChannels([...rooms].reverse()).preselected, 'c-general');
});

test('no open channel: nothing to pick and nothing preselected', () => {
  assert.deepEqual(startThreadChannels([]), { options: [], preselected: null });
  assert.deepEqual(startThreadChannels([room('c-private', 'partners', '2026-10-01T09:00:00Z', { visibility: 'private' })]), {
    options: [],
    preselected: null,
  });
});

test('the start always names the channel the picker shows; nothing only before the list comes', () => {
  // The preselected channel is sent too, so a tie on the date cannot send the thread elsewhere.
  assert.deepEqual(startThreadPayload('c-general'), { channel_uuid: 'c-general' });
  assert.deepEqual(startThreadPayload('c-research'), { channel_uuid: 'c-research' });
  // The list never came (or the Space has none): the server picks, as before.
  assert.deepEqual(startThreadPayload(null), {});
});

test('a refused start says the server’s word on the channel, else its message', () => {
  assert.equal(
    startThreadError({
      message: 'The given data was invalid.',
      errors: { channel_uuid: ['The thread must go in a channel of this Space that every member can read.'] },
    }),
    'The thread must go in a channel of this Space that every member can read.',
  );
  assert.equal(startThreadError({ message: 'This task already has a thread.', errors: null }), 'This task already has a thread.');
});
