import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SpaceTask, SpaceTaskPerson } from '@/types/collab';
import {
  doneFoldLabel,
  groupByPerson,
  groupByStage,
  openTasks,
  overCommitted,
  personSummary,
  TASK_STAGE_LABELS,
  TASK_STAGE_TONE,
  TASK_STAGES,
  taskNote,
  taskThreadHref,
  UNASSIGNED_KEY,
} from './task-board-model';

const person = (uuid: string, name: string): SpaceTaskPerson => ({ uuid, name, username: null, avatar_url: null, is_agent: false });
const ADA = person('u-ada', 'Ada Obi');
const BACKEND = person('u-backend', 'Backend Claude');
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
    ...overrides,
  };
}

test('five stages in order, each wearing a thread status’s chip', () => {
  assert.deepEqual(TASK_STAGES, ['queued', 'working', 'paused', 'waiting', 'done']);
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
});

test('by person: one group per owner, by name, and nobody’s tasks last', () => {
  const groups = groupByPerson([
    task('a', { owner: null }),
    task('b', { owner: STAY }),
    task('c', { owner: BACKEND }),
    task('d', { owner: ADA }),
    task('e', { owner: { ...BACKEND, name: 'backend claude' } }),
  ]);
  assert.deepEqual(
    groups.map((group) => group.key),
    ['u-ada', 'u-backend', 'u-stay', UNASSIGNED_KEY],
  );
  // One group per account, whatever the name's capitals in a later snapshot.
  assert.equal(groups[1].next.length, 2);
});

test('by person: in progress first, then paused, waiting, the queue in order; done apart and newest first', () => {
  const [group] = groupByPerson([
    task('q2', { position: 2 }),
    task('d-old', { stage: 'done', stage_changed_at: '2026-10-20T10:00:00Z' }),
    task('w-new', { stage: 'working', stage_changed_at: '2026-10-28T12:00:00Z' }),
    task('q1', { position: 1 }),
    task('wait', { stage: 'waiting', waiting_on: STAY }),
    task('w-old', { stage: 'working', stage_changed_at: '2026-10-28T08:00:00Z' }),
    task('p', { stage: 'paused', stage_note: 'Switched to the fix' }),
    task('d-new', { stage: 'done', stage_changed_at: '2026-10-27T10:00:00Z' }),
    task('q1-later', { position: 1, created_at: '2026-10-28T09:30:00Z' }),
  ]);
  assert.deepEqual(group.working.map((t) => t.uuid), ['w-old', 'w-new']);
  assert.deepEqual(group.next.map((t) => t.uuid), ['q1', 'q1-later', 'q2']);
  assert.deepEqual(openTasks(group).map((t) => t.uuid), ['w-old', 'w-new', 'p', 'wait', 'q1', 'q1-later', 'q2']);
  assert.deepEqual(group.done.map((t) => t.uuid), ['d-new', 'd-old']);
});

test('a person with only done tasks keeps a group', () => {
  const groups = groupByPerson([task('d', { stage: 'done', owner: BACKEND })]);
  assert.equal(groups.length, 1);
  assert.equal(openTasks(groups[0]).length, 0);
  assert.equal(groups[0].done.length, 1);
});

test('by stage: working first (the board order), empty stages left out, the queue by owner then order', () => {
  const groups = groupByStage([
    task('q-stay', { owner: STAY, position: 0 }),
    task('q-ada-2', { owner: ADA, position: 2 }),
    task('q-none', { owner: null }),
    task('q-ada-1', { owner: ADA, position: 1 }),
    task('done', { stage: 'done' }),
    task('w-new', { stage: 'working', stage_changed_at: '2026-10-28T12:00:00Z' }),
    task('w-old', { stage: 'working', stage_changed_at: '2026-10-28T08:00:00Z' }),
  ]);
  assert.deepEqual(groups.map((group) => group.stage), ['working', 'queued', 'done']);
  assert.deepEqual(groups[0].tasks.map((t) => t.uuid), ['w-old', 'w-new']);
  assert.deepEqual(groups[1].tasks.map((t) => t.uuid), ['q-ada-1', 'q-ada-2', 'q-stay', 'q-none']);
});

test('the note: who a task waits on, or why it is paused', () => {
  assert.equal(taskNote(task('a', { stage: 'waiting', waiting_on: STAY })), 'Waiting on Stay');
  assert.equal(
    taskNote(task('b', { stage: 'waiting', waiting_on: STAY, stage_note: ' A or B for the header ' })),
    'Waiting on Stay · A or B for the header',
  );
  assert.equal(taskNote(task('c', { stage: 'paused', stage_note: 'Switched to the failed-answer fix' })), 'Switched to the failed-answer fix');
  assert.equal(taskNote(task('d', { stage: 'working', stage_note: '   ' })), null);
  assert.equal(taskNote(task('e')), null);
});

test('the head line counts what a person has, and warns at two in progress', () => {
  const [busy] = groupByPerson([
    task('w1', { stage: 'working' }),
    task('w2', { stage: 'working' }),
    task('q', {}),
    task('wait', { stage: 'waiting', waiting_on: STAY }),
  ]);
  assert.equal(personSummary(busy), '2 working · 1 waiting · 1 next');
  assert.equal(overCommitted(busy), true);

  const [idle] = groupByPerson([task('q1'), task('q2', { position: 1 }), task('p', { stage: 'paused', stage_note: 'x' })]);
  assert.equal(personSummary(idle), 'Nothing in progress · 1 paused · 2 next');
  assert.equal(overCommitted(idle), false);
});

test('the done fold and the thread link', () => {
  assert.equal(doneFoldLabel(3), 'Done, last 14 days (3)');
  assert.equal(taskThreadHref({ uuid: 'abc 1', name: 'Task board', channel_uuid: 'c1' }), '/channels/abc%201');
});
