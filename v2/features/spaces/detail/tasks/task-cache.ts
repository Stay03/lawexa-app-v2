import type { ReorderSpaceTasksPayload, SpaceTask } from '@/types/collab';
import type { SpaceTaskChangedEvent } from '@/v2/runtime/realtime/protocol';
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
 * A STALE SNAPSHOT IS IGNORED, AS FAR AS THE ROW CAN TELL. The snapshot has no
 * version or `updated_at`; the one time on it that only moves forward is
 * `stage_changed_at`, and a change that is not a move (a new title, a new
 * thread) keeps it as it was. So a snapshot is refused only when the cached
 * row is STRICTLY newer by `stage_changed_at`: an event that arrives after
 * this tab already saw a later move. Two edits inside one stage cannot be
 * told apart this way, and the later one to arrive wins; the board's next
 * read corrects it.
 */
export function applyTaskChanged(list: readonly SpaceTask[], event: SpaceTaskChangedEvent): SpaceTask[] {
  if (event.action === 'deleted') return removeTask(list, event.task.uuid);
  const cached = list.find((row) => row.uuid === event.task.uuid);
  if (cached && movedAt(cached) > movedAt(event.task)) return [...list];
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

const movedAt = (task: SpaceTask): number => Date.parse(task.stage_changed_at) || 0;
