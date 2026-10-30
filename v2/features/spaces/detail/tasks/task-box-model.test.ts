import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SpaceTask } from '@/types/collab';
import { initialPhoneTab, taskChatLine, taskChatState } from './task-box-model';

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

test('a new task has nothing to chat about yet', () => {
  const state = taskChatState(null, true);
  assert.equal(state.kind, 'new');
  assert.equal(taskChatLine(state), 'Save the task first to chat about it.');
});

test('a task with no thread offers Start a thread only to those who may edit it', () => {
  assert.deepEqual(taskChatState(task(null), true), { kind: 'none', canStart: true });
  assert.deepEqual(taskChatState(task(null), false), { kind: 'none', canStart: false });
  assert.equal(taskChatLine(taskChatState(task(null), true)), 'No chat for this task yet.');
});

test('the server’s flags decide the pane, not the board role', () => {
  // Not readable (the researcher role): the pane says so, whatever the board role.
  for (const canEdit of [true, false]) {
    const hidden = taskChatState(task({ ...THREAD, can_read: false, can_post: false }), canEdit);
    assert.equal(hidden.kind, 'hidden');
    assert.equal(taskChatLine(hidden), 'You can’t see this task’s thread.');
  }
  // Readable, not in the channel: the messages and Join to reply.
  assert.equal(taskChatState(task({ ...THREAD, can_read: true, can_post: false }), true).kind, 'read');
  // In the channel: the composer, for a board Viewer too (as on the thread's own page).
  assert.equal(taskChatState(task({ ...THREAD, can_read: true, can_post: true }), false).kind, 'post');
  assert.equal(taskChatLine(taskChatState(task({ ...THREAD, can_read: true, can_post: true }), false)), null);
});

test('a server from before the flags reads like the thread page: readable and open to post', () => {
  const state = taskChatState(task(THREAD), false);
  assert.equal(state.kind, 'post');
  assert.equal(state.kind === 'post' && state.thread.uuid, 'thread-uuid-1');
});

test('a phone opens on the details, or on the chat when opened to reply; a new task always on the details', () => {
  assert.equal(initialPhoneTab(task(THREAD), null), 'details');
  assert.equal(initialPhoneTab(task(THREAD), 'details'), 'details');
  assert.equal(initialPhoneTab(task(THREAD), 'chat'), 'chat');
  assert.equal(initialPhoneTab(null, 'chat'), 'details');
});
