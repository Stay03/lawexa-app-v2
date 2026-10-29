import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SpaceTask, SpaceTaskPerson } from '@/types/collab';
import {
  BOARD_STAGES,
  boardColumns,
  filterByOwner,
  ownerOptions,
  TASK_STAGE_LABELS,
  TASK_STAGE_TONE,
  TASK_STAGES,
  taskNote,
  taskThreadHref,
  UNASSIGNED_KEY,
} from './task-board-model';

const person = (uuid: string, name: string, is_agent = false): SpaceTaskPerson => ({
  uuid,
  name,
  username: null,
  avatar_url: null,
  is_agent,
});
const ADA = person('u-ada', 'Ada Obi');
const BACKEND = person('u-backend', 'Backend Claude', true);
const STAY = person('u-stay', 'Stay');

function task(uuid: string, overrides: Partial<SpaceTask> = {}): SpaceTask {
  return {
    uuid,
    title: `Task ${uuid}`,
    stage: 'queued',
    stage_note: null,
    waiting_on: null,
    owner: ADA,
    thread: null,
    position: 0,
    started_at: null,
    stage_changed_at: '2026-10-28T10:00:00Z',
    stage_changed_by: null,
    via: 'app',
    created_at: '2026-10-28T09:00:00Z',
    created_by: null,
    updated_at: '2026-10-28T10:00:00Z',
    ...overrides,
  };
}

test('five stages, each wearing a thread status’s dot; the board reads Working first and Done last', () => {
  assert.deepEqual(
    TASK_STAGES.map((stage) => TASK_STAGE_LABELS[stage]),
    ['Queued', 'Working', 'Paused', 'Waiting', 'Done'],
  );
  // No new colours (techlead, 28 October 2026): Paused is On Hold's, Waiting is Needs Action's.
  assert.deepEqual(TASK_STAGE_TONE, {
    queued: 'queued',
    working: 'working',
    paused: 'on_hold',
    waiting: 'needs_action',
    done: 'completed',
  });
  assert.deepEqual(BOARD_STAGES, ['working', 'paused', 'waiting', 'queued', 'done']);
});

test('the columns: every stage kept, each in its own order', () => {
  const columns = boardColumns([
    task('q-stay', { owner: STAY }),
    task('q-ada-2', { position: 2 }),
    task('q-none', { owner: null }),
    task('q-ada-1', { position: 1 }),
    task('w-new', { stage: 'working', stage_changed_at: '2026-10-28T12:00:00Z' }),
    task('w-old', { stage: 'working', stage_changed_at: '2026-10-28T08:00:00Z' }),
    task('d-old', { stage: 'done', stage_changed_at: '2026-10-20T10:00:00Z' }),
    task('d-new', { stage: 'done', stage_changed_at: '2026-10-27T10:00:00Z' }),
  ]);
  assert.deepEqual(columns.working.map((t) => t.uuid), ['w-old', 'w-new']);
  // The queue by owner (nobody's last), then each owner's own order.
  assert.deepEqual(columns.queued.map((t) => t.uuid), ['q-ada-1', 'q-ada-2', 'q-stay', 'q-none']);
  assert.deepEqual(columns.done.map((t) => t.uuid), ['d-new', 'd-old']);
  // An empty stage is still a column.
  assert.deepEqual(columns.paused, []);
  assert.deepEqual(columns.waiting, []);
});

test('the owner filter: people, then agents, then nobody; each counts open tasks only', () => {
  const tasks = [
    task('a', { owner: BACKEND, stage: 'working' }),
    task('b', { owner: BACKEND, stage: 'done' }),
    task('c', { owner: STAY }),
    task('d', { owner: null }),
    task('e', { owner: ADA, stage: 'paused', stage_note: 'x' }),
  ];
  assert.deepEqual(ownerOptions(tasks), [
    { key: 'u-ada', name: 'Ada Obi', isAgent: false, open: 1 },
    { key: 'u-stay', name: 'Stay', isAgent: false, open: 1 },
    { key: 'u-backend', name: 'Backend Claude', isAgent: true, open: 1 },
    { key: UNASSIGNED_KEY, name: 'Nobody yet', isAgent: false, open: 1 },
  ]);
  assert.deepEqual(filterByOwner(tasks, 'u-backend').map((t) => t.uuid), ['a', 'b']);
  assert.deepEqual(filterByOwner(tasks, UNASSIGNED_KEY).map((t) => t.uuid), ['d']);
  assert.equal(filterByOwner(tasks, null), tasks);
});

test('a card’s second line: who it waits on, or why it is paused, and nothing for the rest', () => {
  assert.equal(taskNote(task('a', { stage: 'waiting', waiting_on: STAY })), 'Waiting on Stay');
  assert.equal(
    taskNote(task('b', { stage: 'waiting', waiting_on: STAY, stage_note: ' A or B for the header ' })),
    'Waiting on Stay · A or B for the header',
  );
  assert.equal(taskNote(task('c', { stage: 'paused', stage_note: 'Switched to the failed-answer fix' })), 'Switched to the failed-answer fix');
  assert.equal(taskNote(task('d', { stage: 'working', stage_note: 'notes on a working task stay off the card' })), null);
  assert.equal(taskNote(task('e')), null);
});

test('the thread link stays inside the app', () => {
  assert.equal(taskThreadHref({ uuid: 'abc 1', name: 'Task board', channel_uuid: 'c1' }), '/channels/abc%201');
});
