import type { ReorderSpaceTasksPayload, SpaceTask } from '@/types/collab';
import type { SpaceTaskSnapshotEvent } from '@/v2/runtime/realtime/protocol';
import { queueOrder } from './task-board-model';

/**
 * task-cache — how a write and a live event change the cached board (the
 * techlead's brief for the task sheet, New task, reorder and live updates, 29
 * October 2026). Pure, so every rule is a unit test. The board's cache entry
 * is `SpaceTask[]` (`spacesQueries.tasks`), in the server's board order; the
 * columns sort it again, so a write only has to put the row in or take it out.
 */

/** The list with this task in it: the cached row replaced, or the task added. */
export function upsertTask(list: readonly SpaceTask[], task: SpaceTask): SpaceTask[] {
  const index = list.findIndex((row) => row.uuid === task.uuid);
  if (index === -1) return [...list, task];
  const next = [...list];
  next[index] = task;
  return next;
}

/** The list without this task. The same list when it was not there. */
export function removeTask(list: readonly SpaceTask[], taskUuid: string): SpaceTask[] {
  return list.filter((row) => row.uuid !== taskUuid);
}

/**
 * One `.task.changed` event on the cached board. `deleted` takes the row out;
 * `created` and `updated` put the snapshot in.
 *
 * EVENTS CAN ARRIVE OUT OF ORDER (the techlead's review, 29 October 2026):
 * the server queues its broadcasts, so with more than one worker an
 * `updated` can land after a later `updated`, or after the `deleted`.
 * - A snapshot older than the cached row by `updated_at` is ignored.
 *   `updated_at` moves forward on every change, a move or not, so edits
 *   inside one stage are ordered too. It is whole seconds: two edits in the
 *   same second tie, and a tie goes to the snapshot that arrives last, on
 *   purpose. The board's next read settles it.
 * - A task in `deleted` (the uuids this board has seen deleted) never comes
 *   back from a late `created` or `updated`. A delete is soft and final.

 */
export function applyTaskChanged(
  list: readonly SpaceTask[],
  event: SpaceTaskSnapshotEvent,
  deleted: ReadonlySet<string>,
): SpaceTask[] {
  if (event.action === 'deleted') return removeTask(list, event.task.uuid);
  if (deleted.has(event.task.uuid)) return [...list];
  const cached = list.find((row) => row.uuid === event.task.uuid);
  if (cached && changedAt(cached) > changedAt(event.task)) return [...list];
  return upsertTask(list, event.task);
}

export type QueueDirection = 'up' | 'down';

/** Whose queue a task is in: the owner's uuid, or `null` for nobody's. */
export function queueOwner(task: SpaceTask): string | null {
  return task.owner?.uuid ?? null;
}

/**
 * The reorder that moves one queued task up or down its owner's queue, or
 * `null` when it cannot move that way (not queued, or already first or last
 * among the owner's queued tasks).
 *
 * The server wants EVERY open task of the owner, each once, in the new order
 * (`POST .../tasks/reorder`), so the list is all of them (not only the queued
 * ones) by their current order, with the task swapped with the next queued
 * task in that direction. The other stages keep their places.
 */
export function reorderedQueue(
  tasks: readonly SpaceTask[],
  taskUuid: string,
  direction: QueueDirection,
): ReorderSpaceTasksPayload | null {
  const task = tasks.find((row) => row.uuid === taskUuid);
  if (!task || task.stage !== 'queued') return null;
  const owner = queueOwner(task);
  const open = tasks.filter((row) => row.stage !== 'done' && queueOwner(row) === owner).sort(queueOrder);
  const at = open.findIndex((row) => row.uuid === taskUuid);
  const step = direction === 'up' ? -1 : 1;
  let other = at + step;
  while (other >= 0 && other < open.length && open[other].stage !== 'queued') other += step;
  if (other < 0 || other >= open.length) return null;
  const uuids = open.map((row) => row.uuid);
  [uuids[at], uuids[other]] = [uuids[other], uuids[at]];
  return { owner_uuid: owner, uuids };
}

/** The board with the reorder already applied: each named task's position is
 *  its place in the list, so the Queued column shows the new order at once. */
export function applyReorder(list: readonly SpaceTask[], reorder: ReorderSpaceTasksPayload): SpaceTask[] {
  const place = new Map(reorder.uuids.map((uuid, index) => [uuid, index] as const));
  return list.map((row) => {
    const position = place.get(row.uuid);
    return position === undefined || position === row.position ? row : { ...row, position };
  });
}

const changedAt = (task: SpaceTask): number => Date.parse(task.updated_at) || 0;

/**
 * A write refused with 404 (Stay's B, Backend fb826d73): the task is gone
 * from this person's board, deleted or now linked to a thread they may not
 * read. The card comes off the board rather than being put back.
 */
export function failedTaskWrite(list: readonly SpaceTask[], status: number | null, before: SpaceTask | null, taskUuid: string): SpaceTask[] {
  if (status === 404) return removeTask(list, taskUuid);
  return before ? upsertTask(list, before) : [...list];
}

/**
 * One call `waitMs` after the last of a burst (Frontend's review of B, 11:54Z:
 * each `refresh` would otherwise start its own read). `cancel` drops a call
 * still waiting. The clock is passed in, so a test can drive it.
 */
export function trailingCall(
  run: () => void,
  waitMs: number,
  clock: { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void } = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
): { call: () => void; cancel: () => void } {
  let waiting: unknown = null;
  const cancel = () => {
    if (waiting !== null) clock.clear(waiting);
    waiting = null;
  };
  return {
    call: () => {
      cancel();
      waiting = clock.set(() => {
        waiting = null;
        run();
      }, waitMs);
    },
    cancel,
  };
}
