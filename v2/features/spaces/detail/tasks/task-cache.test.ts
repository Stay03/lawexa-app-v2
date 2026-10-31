import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SpaceTask, SpaceTaskPerson } from '@/types/collab';
import { applyReorder, applyTaskChanged, failedTaskWrite, removeTask, reorderedQueue, trailingCall, upsertTask } from './task-cache';

const person = (uuid: string, name: string): SpaceTaskPerson => ({
  uuid,
  name,
  username: null,
  avatar_url: null,
  is_agent: false,
});
const ADA = person('u-ada', 'Ada Obi');
const BEN = person('u-ben', 'Ben');

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
    stage_changed_at: '2026-10-29T10:00:00Z',
    stage_changed_by: null,
    via: 'app',
    created_at: '2026-10-28T10:00:00Z',
    created_by: null,
    updated_at: '2026-10-29T10:00:00Z',
    ...overrides,
  };
}

test('upsert replaces the cached row in place, or adds a new one', () => {
  const list = [task('a'), task('b')];
  const renamed = upsertTask(list, task('b', { title: 'Renamed' }));
  assert.deepEqual(
    renamed.map((row) => [row.uuid, row.title]),
    [
      ['a', 'Task a'],
      ['b', 'Renamed'],
    ],
  );
  assert.deepEqual(
    upsertTask(list, task('c')).map((row) => row.uuid),
    ['a', 'b', 'c'],
  );
  // The cached list is never changed in place.
  assert.equal(list[1].title, 'Task b');
});

test('remove takes the row out, and leaves a list without it as it was', () => {
  const list = [task('a'), task('b')];
  assert.deepEqual(
    removeTask(list, 'a').map((row) => row.uuid),
    ['b'],
  );
  assert.deepEqual(
    removeTask(list, 'zz').map((row) => row.uuid),
    ['a', 'b'],
  );
});

const NONE_DELETED: ReadonlySet<string> = new Set();

test('a live event writes its snapshot: created adds, updated replaces, deleted removes', () => {
  const list = [task('a')];
  const created = applyTaskChanged(list, { action: 'created', task: task('b') }, NONE_DELETED);
  assert.deepEqual(
    created.map((row) => row.uuid),
    ['a', 'b'],
  );
  const moved = applyTaskChanged(
    created,
    { action: 'updated', task: task('a', { stage: 'working', updated_at: '2026-10-29T11:00:00Z' }) },
    NONE_DELETED,
  );
  assert.equal(moved.find((row) => row.uuid === 'a')?.stage, 'working');
  const deleted = applyTaskChanged(moved, { action: 'deleted', task: task('b') }, NONE_DELETED);
  assert.deepEqual(
    deleted.map((row) => row.uuid),
    ['a'],
  );
});

test('a snapshot older than the cached row by updated_at is ignored, also inside one stage', () => {
  const list = [task('a', { title: 'Second title', updated_at: '2026-10-29T11:00:00Z' })];
  const stale = applyTaskChanged(
    list,
    { action: 'updated', task: task('a', { title: 'First title', updated_at: '2026-10-29T10:30:00Z' }) },
    NONE_DELETED,
  );
  assert.equal(stale[0].title, 'Second title');
  // A newer one lands, though the stage and its move time are unchanged.
  const fresh = applyTaskChanged(
    list,
    { action: 'updated', task: task('a', { title: 'Third title', updated_at: '2026-10-29T11:30:00Z' }) },
    NONE_DELETED,
  );
  assert.equal(fresh[0].title, 'Third title');
});

test('two edits in the same second tie, and the one that arrives last wins on purpose', () => {
  // updated_at is whole seconds (the techlead's recheck): no order to read inside one.
  const list = [task('a', { title: 'First', updated_at: '2026-10-29T11:00:00Z' })];
  const tied = applyTaskChanged(
    list,
    { action: 'updated', task: task('a', { title: 'Second', updated_at: '2026-10-29T11:00:00Z' }) },
    NONE_DELETED,
  );
  assert.equal(tied[0].title, 'Second');
});

test('an update that arrives after the delete does not bring the task back', () => {
  // The techlead's review, 29 October 2026: queued broadcasts can land out of order.
  const deleted = new Set<string>();
  let list = [task('a'), task('b')];
  deleted.add('b');
  list = applyTaskChanged(list, { action: 'deleted', task: task('b') }, deleted);
  list = applyTaskChanged(
    list,
    { action: 'updated', task: task('b', { title: 'Late', updated_at: '2026-10-29T09:00:00Z' }) },
    deleted,
  );
  assert.deepEqual(
    list.map((row) => row.uuid),
    ['a'],
  );
  // Not even a late one that claims to be newer.
  list = applyTaskChanged(
    list,
    { action: 'updated', task: task('b', { updated_at: '2026-10-30T09:00:00Z' }) },
    deleted,
  );
  assert.deepEqual(
    list.map((row) => row.uuid),
    ['a'],
  );
});

test('Move up swaps with the queued task above, and the reorder lists every open task of the owner', () => {
  const tasks = [
    task('w', { stage: 'working', position: 0 }),
    task('q1', { position: 1 }),
    task('p', { stage: 'paused', stage_note: 'x', position: 2 }),
    task('q2', { position: 3 }),
    task('d', { stage: 'done', position: 4 }),
    task('ben', { owner: BEN, position: 0 }),
  ];
  // q2 skips the paused task and trades places with q1; the others stay put.
  assert.deepEqual(reorderedQueue(tasks, 'q2', 'up'), { owner_uuid: 'u-ada', uuids: ['w', 'q2', 'p', 'q1'] });
  assert.deepEqual(reorderedQueue(tasks, 'q1', 'down'), { owner_uuid: 'u-ada', uuids: ['w', 'q2', 'p', 'q1'] });
  // First and last among the queued ones cannot move further.
  assert.equal(reorderedQueue(tasks, 'q1', 'up'), null);
  assert.equal(reorderedQueue(tasks, 'q2', 'down'), null);
  // Only a queued task moves.
  assert.equal(reorderedQueue(tasks, 'w', 'down'), null);
  // Ben is alone in his queue.
  assert.equal(reorderedQueue(tasks, 'ben', 'up'), null);
});

test('the tasks nobody has are one queue, sent with owner_uuid null', () => {
  const tasks = [task('n1', { owner: null, position: 0 }), task('n2', { owner: null, position: 1 }), task('a')];
  assert.deepEqual(reorderedQueue(tasks, 'n2', 'up'), { owner_uuid: null, uuids: ['n2', 'n1'] });
});

test('a reorder applied to the cache gives each named task its place as its position', () => {
  const tasks = [task('q1', { position: 0 }), task('q2', { position: 1 }), task('ben', { owner: BEN, position: 0 })];
  const next = applyReorder(tasks, { owner_uuid: 'u-ada', uuids: ['q2', 'q1'] });
  assert.deepEqual(
    next.map((row) => [row.uuid, row.position]),
    [
      ['q1', 1],
      ['q2', 0],
      ['ben', 0],
    ],
  );
  // A row that did not move is the same object.
  assert.equal(next[2], tasks[2]);
});

/* Stay's B (Backend fb826d73): cards some members may not see. */

test('a write refused with 404 takes the card off the board; any other refusal puts it back as it was', () => {
  const before = task('t1', { title: 'TEST DATA before' });
  const shown = task('t1', { title: 'TEST DATA moved' });
  const other = task('t2');
  assert.deepEqual(failedTaskWrite([shown, other], 404, before, 't1'), [other]);
  assert.deepEqual(failedTaskWrite([shown, other], 422, before, 't1'), upsertTask([shown, other], before));
  // A write that was not optimistic has nothing to put back.
  assert.deepEqual(failedTaskWrite([shown, other], 500, null, 't1'), [shown, other]);
});

test('a burst of refreshes reads the board once, after the last of them', () => {
  let now = 0;
  const pending: { at: number; fn: () => void; id: number }[] = [];
  let ids = 0;
  const clock = {
    set: (fn: () => void, ms: number) => {
      pending.push({ at: now + ms, fn, id: ++ids });
      return ids;
    },
    clear: (handle: unknown) => {
      const at = pending.findIndex((entry) => entry.id === handle);
      if (at >= 0) pending.splice(at, 1);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const entry of pending.filter((item) => item.at <= now)) {
      pending.splice(pending.indexOf(entry), 1);
      entry.fn();
    }
  };
  let reads = 0;
  const refresh = trailingCall(() => reads++, 300, clock);
  refresh.call();
  advance(100);
  refresh.call();
  advance(100);
  refresh.call();
  advance(299);
  assert.equal(reads, 0);
  advance(1);
  assert.equal(reads, 1);
  // A board that closes drops a read still waiting.
  refresh.call();
  refresh.cancel();
  advance(300);
  assert.equal(reads, 1);
});
