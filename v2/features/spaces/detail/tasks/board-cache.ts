import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';

import type { ReorderSpaceTasksPayload, SpaceTask, SpaceTaskListResponse } from '@/types/collab';
import type { SpaceTaskSnapshotEvent } from '@/v2/runtime/realtime/protocol';
import { spacesQueries } from '../../queries';
import { applyReorder, applyTaskChanged, dropDoneTask, placeDoneTask, placeTask, removeTask, type BoardChannel } from './task-cache';

/**
 * board-cache — every cached read of one space's board for one viewer, written
 * together (thread 550bf0ab). The board keeps an open read and a done read per
 * channel filter it has shown (`spacesQueries.tasks`, `spacesQueries.doneTasks`),
 * so a write or a live event goes into each, by the rules in `task-cache.ts`:
 * a card lands only in the reads whose channel it is in.
 */

/** The channel and viewer a board read was made for: the key's last two parts. */
function partsOf(key: QueryKey): { channel: BoardChannel; viewerId: unknown } {
  const channel = (key.at(-2) as { channel?: BoardChannel } | undefined)?.channel ?? null;
  const viewerId = (key.at(-1) as { viewerId?: unknown } | undefined)?.viewerId;
  return { channel, viewerId };
}

export type BoardSnapshot = readonly (readonly [QueryKey, unknown])[];

export function boardCache(queryClient: QueryClient, spaceUuid: string, viewerId: number | null) {
  const mine = <T>(prefix: QueryKey) =>
    queryClient
      .getQueriesData<T>({ queryKey: prefix })
      .filter(([key, data]) => data !== undefined && partsOf(key).viewerId === viewerId) as [QueryKey, T][];
  const opens = () => mine<SpaceTask[]>(spacesQueries.openTasksOf(spaceUuid));
  const dones = () => mine<InfiniteData<SpaceTaskListResponse>>(spacesQueries.doneTasksOf(spaceUuid));
  const eachOpen = (change: (list: readonly SpaceTask[], channel: BoardChannel) => SpaceTask[]) => {
    for (const [key, list] of opens()) queryClient.setQueryData<SpaceTask[]>(key, change(list, partsOf(key).channel));
  };
  const eachDone = (
    change: (data: InfiniteData<SpaceTaskListResponse>, channel: BoardChannel) => InfiniteData<SpaceTaskListResponse>,
  ) => {
    for (const [key, data] of dones()) {
      queryClient.setQueryData<InfiniteData<SpaceTaskListResponse>>(key, change(data, partsOf(key).channel));
    }
  };

  return {
    /** The card as the server or the board now has it, in every read it belongs in. */
    put(task: SpaceTask) {
      eachOpen((list, channel) => placeTask(list, task, channel));
      eachDone((data, channel) => placeDoneTask(data, task, channel));
    },
    /** The card off every read. */
    drop(taskUuid: string) {
      eachOpen((list) => removeTask(list, taskUuid));
      eachDone((data) => dropDoneTask(data, taskUuid));
    },
    /** One live `.task.changed` with its snapshot. */
    applyEvent(event: SpaceTaskSnapshotEvent, deleted: ReadonlySet<string>) {
      eachOpen((list, channel) => applyTaskChanged(list, event, deleted, channel));
      if (event.action === 'deleted') eachDone((data) => dropDoneTask(data, event.task.uuid));
      else if (!deleted.has(event.task.uuid)) eachDone((data, channel) => placeDoneTask(data, event.task, channel));
    },
    /** The board's copy of a card, from any read. */
    find(taskUuid: string): SpaceTask | null {
      for (const [, list] of opens()) {
        const found = list.find((row) => row.uuid === taskUuid);
        if (found) return found;
      }
      for (const [, data] of dones()) {
        for (const page of data.pages) {
          const found = page.data.find((row) => row.uuid === taskUuid);
          if (found) return found;
        }
      }
      return null;
    },
    /** A queue reorder in every open read; the reads as they were, to put back. */
    reorder(payload: ReorderSpaceTasksPayload): BoardSnapshot {
      const before = opens();
      eachOpen((list) => applyReorder(list, payload));
      return before;
    },
    restore(snapshot: BoardSnapshot) {
      for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
    },
    /** Stop reads in flight, so none lands over an optimistic write. */
    cancel: () => queryClient.cancelQueries({ queryKey: spacesQueries.tasksOf(spaceUuid) }),
  };
}
