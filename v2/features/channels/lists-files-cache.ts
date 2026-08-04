import type { QueryClient } from '@tanstack/react-query';
import type {
  ChannelFile,
  ChannelFileListResponse,
  TaskList,
  TaskListItem,
  TaskListResponse,
  TaskListSummary,
  TaskListSummaryListResponse,
} from '@/types/collab';
import { channelsQueries } from './queries';

/**
 * lists-files cache — the reference-stable writers for the channel task-list
 * and file-library caches, shared by the mutations
 * (`./lists-files-mutations.ts`) and the room's `.list.changed` /
 * `.file.changed` handlers (`./room.ts`). Phase-5 W2, audit note N3 (deferred
 * from W1 because these v2 keys did not exist yet); a PORT of v1
 * `useCollab.ts`'s two-shape reconciliation — never an import (boundary rule;
 * study A5 marks the writers "fiddly but correct — port, don't reinvent").
 * Sources: LF §2–5 via `api-digest.md` §B/§C (2026-08-04).
 *
 * TWO LIST SHAPES — ONE RECONCILIATION PATH. The INDEX cache holds
 * `TaskListSummary` (counts, no items); the DETAIL cache and every
 * mutation/broadcast carry a full `TaskList` (items, no counts). To keep the
 * two from drifting, the summary is DERIVED from the detail (`items.length` /
 * checked filter) and every write flows through {@link upsertListCaches} —
 * exactly v1's invariant, on the v2 viewer-partitioned keys.
 *
 * REFERENTIAL STABILITY ON A NO-OP is the house cache-writer contract
 * (`./cache.ts` docblock): every transform returns its exact input when
 * nothing changed, so the fan-out across viewer variants cannot re-render
 * surfaces that don't hold the row.
 *
 * VIEWER PARTITION NOTE: the keys carry `{ viewerId }` segments, so writers
 * use `setQueriesData` over the `listsOf`/`listDetailOf`/`filesOf` PREFIXES —
 * they update every existing variant and never conjure an entry for a viewer
 * who hasn't fetched (the one exception, seeding a just-created list's detail,
 * lives in the mutation where the viewerId is known).
 */

/** Collapse a full `TaskList` into its index summary — counts derived from
 *  `items` so index and detail can never disagree. */
export function taskListToSummary(list: TaskList): TaskListSummary {
  return {
    uuid: list.uuid,
    channel_uuid: list.channel_uuid,
    title: list.title,
    description: list.description,
    is_ai: list.is_ai,
    creator: list.creator,
    items_count: list.items.length,
    checked_count: list.items.filter((item) => item.is_checked).length,
    settings: list.settings,
    created_at: list.created_at,
    updated_at: list.updated_at,
  };
}

/** Write a summary into every cached index variant (update or prepend). */
function writeSummaryToIndexes(
  queryClient: QueryClient,
  channelUuid: string,
  summary: TaskListSummary,
): void {
  queryClient.setQueriesData<TaskListSummaryListResponse>(
    { queryKey: channelsQueries.taskListsOf(channelUuid) },
    (data) => {
      if (!data) return data;
      const exists = data.data.some((row) => row.uuid === summary.uuid);
      if (exists) {
        let changed = false;
        const rows = data.data.map((row) => {
          if (row.uuid !== summary.uuid) return row;
          changed = true;
          return summary;
        });
        return changed ? { ...data, data: rows } : data;
      }
      return {
        ...data,
        data: [summary, ...data.data],
        pagination: { ...data.pagination, total: data.pagination.total + 1 },
      };
    },
  );
}

/**
 * Reconcile a full `TaskList`: replace it in every existing detail variant and
 * derive its summary into every index variant. The ONE path taken by mutation
 * success handlers AND the `.list.changed` broadcast (`created` / `updated` /
 * `item_changed` all deliver the full snapshot — replace whole, LF §5).
 */
export function upsertListCaches(
  queryClient: QueryClient,
  channelUuid: string,
  list: TaskList,
): void {
  queryClient.setQueriesData<TaskListResponse>(
    { queryKey: channelsQueries.taskListDetailOf(list.uuid) },
    (data) => (data ? { ...data, data: list } : data),
  );
  writeSummaryToIndexes(queryClient, channelUuid, taskListToSummary(list));
}

/** Drop a list from every index variant and evict its detail entries. */
export function removeListCaches(
  queryClient: QueryClient,
  channelUuid: string,
  listUuid: string,
): void {
  queryClient.setQueriesData<TaskListSummaryListResponse>(
    { queryKey: channelsQueries.taskListsOf(channelUuid) },
    (data) => {
      if (!data) return data;
      const rows = data.data.filter((row) => row.uuid !== listUuid);
      if (rows.length === data.data.length) return data;
      return {
        ...data,
        data: rows,
        pagination: {
          ...data.pagination,
          total: Math.max(0, data.pagination.total - 1),
        },
      };
    },
  );
  queryClient.removeQueries({ queryKey: channelsQueries.taskListDetailOf(listUuid) });
}

/**
 * Patch one list's cached items through `map` (every detail variant) and
 * re-derive its index summary — the optimistic item-mutation path. `map`
 * receives the current items and returns the next array (same reference =
 * no-op).
 */
export function patchListItems(
  queryClient: QueryClient,
  channelUuid: string,
  listUuid: string,
  map: (items: TaskListItem[]) => TaskListItem[],
): void {
  let patched: TaskList | null = null;
  queryClient.setQueriesData<TaskListResponse>(
    { queryKey: channelsQueries.taskListDetailOf(listUuid) },
    (data) => {
      if (!data) return data;
      const items = map(data.data.items);
      if (items === data.data.items) return data;
      patched = { ...data.data, items };
      return { ...data, data: patched };
    },
  );
  if (patched) {
    writeSummaryToIndexes(queryClient, channelUuid, taskListToSummary(patched));
  }
}

/** Prepend a file into every cached library variant, de-duplicated by id
 *  (the uploader's own reconcile usually landed first; Reverb can redeliver). */
export function addFileCache(
  queryClient: QueryClient,
  channelUuid: string,
  file: ChannelFile,
): void {
  queryClient.setQueriesData<ChannelFileListResponse>(
    { queryKey: channelsQueries.filesOf(channelUuid) },
    (data) => {
      if (!data) return data;
      if (data.data.some((row) => row.id === file.id)) return data;
      return {
        ...data,
        data: [file, ...data.data],
        pagination: { ...data.pagination, total: data.pagination.total + 1 },
      };
    },
  );
}

/** Drop a file (by integer id — files are the uuid-only rule's exception,
 *  digest §F.4) from every cached library variant. */
export function removeFileCache(
  queryClient: QueryClient,
  channelUuid: string,
  fileId: number,
): void {
  queryClient.setQueriesData<ChannelFileListResponse>(
    { queryKey: channelsQueries.filesOf(channelUuid) },
    (data) => {
      if (!data) return data;
      const rows = data.data.filter((row) => row.id !== fileId);
      if (rows.length === data.data.length) return data;
      return {
        ...data,
        data: rows,
        pagination: {
          ...data.pagination,
          total: Math.max(0, data.pagination.total - 1),
        },
      };
    },
  );
}
