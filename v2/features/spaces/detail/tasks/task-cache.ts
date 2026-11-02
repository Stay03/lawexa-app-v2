import type { InfiniteData } from '@tanstack/react-query';

import type { ReorderSpaceTasksPayload, SpaceTask, SpaceTaskListResponse } from '@/types/collab';
import type { SpaceTaskSnapshotEvent } from '@/v2/runtime/realtime/protocol';
import { queueOrder } from './task-board-model';

/**
 * task-cache — how a write and a live event change the cached board (the
 * techlead's brief for the task sheet, New task, reorder and live updates, 29
 * October 2026). Pure, so every rule is a unit test. The board's cache entry
 * is `SpaceTask[]` (`spacesQueries.tasks`), in the server's board order; the
 * columns sort it again, so a write only has to put the row in or take it out.
 *
 * TWO READS PER CHANNEL (Arthur's yes, thread 550bf0ab): the open cards, every
 * page (`spacesQueries.tasks`), and the done ones a page at a time
 * (`spacesQueries.doneTasks`), each for one channel filter. A write goes into
 * every open read whose channel the card is in, and out of the others; a done
 * read only ever loses a card, until the board reads it again. The board joins
 * the two with {@link mergeBoard}, the newer copy of a card winning, so a card
 * moved to Done shows there at once from the open read's copy.
 */

/** The board's channel filter: every channel (`null`), one by uuid, or the cards with none. */
export type BoardChannel = string | null;

/** The filter's word for the cards with no channel (`channel=none`). */
export const NO_CHANNEL = 'none';

/** Whether a card shows under a channel filter. */
export function taskInChannel(task: Pick<SpaceTask, 'channel'>, channel: BoardChannel): boolean {
  if (channel === null) return true;
  if (channel === NO_CHANNEL) return !task.channel;
  return task.channel?.uuid === channel;
}

/** An open read with this card written in: put in where its channel is shown, taken out where not. */
export function placeTask(list: readonly SpaceTask[], task: SpaceTask, channel: BoardChannel): SpaceTask[] {
  return taskInChannel(task, channel) ? upsertTask(list, task) : removeTask(list, task.uuid);
}

/** A done read with this card written in: it keeps the card only while the card is done and in its channel. */
export function placeDoneTask(
  data: InfiniteData<SpaceTaskListResponse>,
  task: SpaceTask,
  channel: BoardChannel,
): InfiniteData<SpaceTaskListResponse> {
  const keep = task.stage === 'done' && taskInChannel(task, channel);
  // A late snapshot never replaces a newer copy.
  return mapDonePages(data, (rows) =>
    keep
      ? rows.map((row) => (row.uuid === task.uuid && changedAt(task) >= changedAt(row) ? task : row))
      : rows.filter((row) => row.uuid !== task.uuid),
  );
}

/** A done read without this card. */
export function dropDoneTask(data: InfiniteData<SpaceTaskListResponse>, taskUuid: string): InfiniteData<SpaceTaskListResponse> {
  return mapDonePages(data, (rows) => rows.filter((row) => row.uuid !== taskUuid));
}

function mapDonePages(
  data: InfiniteData<SpaceTaskListResponse>,
  change: (rows: readonly SpaceTask[]) => SpaceTask[],
): InfiniteData<SpaceTaskListResponse> {
  return { ...data, pages: data.pages.map((page) => ({ ...page, data: change(page.data) })) };
}

/**
 * The board's cards: the open read and the done pages, each card once. Where
 * both hold a card, the newer by `updated_at` wins (a tie goes to the open
 * read, where writes land), so a card just moved to Done or back shows in its
 * new column before either read is repeated.
 */
export function mergeBoard(open: readonly SpaceTask[], done: readonly SpaceTask[]): SpaceTask[] {
  const cards = new Map<string, SpaceTask>();
  for (const task of done) cards.set(task.uuid, task);
  for (const task of open) {
    const other = cards.get(task.uuid);
    if (!other || changedAt(task) >= changedAt(other)) cards.set(task.uuid, task);
  }
  return [...cards.values()];
}

/** What Done's head counts: the server's total, or the cards shown when more are. */
export function doneCount(shown: number, total: number | null): number {
  return total === null ? shown : Math.max(shown, total);
}

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
  channel: BoardChannel = null,
): SpaceTask[] {
  if (event.action === 'deleted') return removeTask(list, event.task.uuid);
  if (deleted.has(event.task.uuid)) return [...list];
  const cached = list.find((row) => row.uuid === event.task.uuid);
  if (cached && changedAt(cached) > changedAt(event.task)) return [...list];
  return placeTask(list, event.task, channel);
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
