'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { channelFilesApi, channelListsApi } from '@/lib/api/collab';
import { filesApi } from '@/lib/api/files';
import { useAuthStore } from '@/lib/stores/authStore';
import type {
  AddListItemPayload,
  CreateListPayload,
  TaskList,
  TaskListItem,
  TaskListResponse,
  UpdateListPayload,
} from '@/types/collab';
import {
  addFileCache,
  patchListItems,
  removeFileCache,
  removeListCaches,
  upsertListCaches,
} from './lists-files-cache';
import { LOCAL_ITEM_PREFIX } from './model';
import { channelsQueries } from './queries';

/**
 * lists-files-mutations — the Lists/Files tab write paths, ported from v1
 * `useCollab.ts` onto the v2 keys and the N3 writers (`./lists-files-cache.ts`).
 * Sources: LF §2–4 via api-digest §C (item ops 60/min, list create 30/min,
 * reorder = the FULL uuid set exactly once), study A5/A6 KEEP verdicts —
 * 2026-08-04.
 *
 * Optimistic almost everywhere (check, edit, remove, reorder, add-with-temp-
 * row); reconciliation always flows through the shared writers so the index's
 * derived counts can never disagree with the detail. Dialog-driven mutations
 * (`create`, `rename`, `delete list`) are `silentError` with inline dialog
 * errors; the rest fall to the global error channel with a cache rollback as
 * the visible inline mirror.
 */

let localItemCounter = 0;

function actingUser() {
  const me = useAuthStore.getState().user;
  return me
    ? { uuid: me.uuid ?? '', name: me.name, avatar_url: me.avatar_url }
    : null;
}

/* ── Lists ────────────────────────────────────────────────────────────────── */

/** Create a list. The full returned `TaskList` seeds the viewer's detail key
 *  (so opening it straight away is a cache hit) and derives into the index. */
export function useCreateList(channelUuid: string, viewerId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateListPayload) =>
      channelListsApi.create(channelUuid, payload),
    meta: { silentError: true },
    onSuccess: (response) => {
      // Seed the exact viewer-partitioned detail key — the one write that may
      // CREATE an entry, which the prefix writers deliberately never do.
      queryClient.setQueryData<TaskListResponse>(
        channelsQueries.taskListDetail(response.data.uuid, { viewerId }).queryKey,
        response,
      );
      upsertListCaches(queryClient, channelUuid, response.data);
    },
  });
}

/** Rename / edit a list; title + description move optimistically. */
export function useUpdateList(channelUuid: string, listUuid: string) {
  const queryClient = useQueryClient();
  return useMutation<
    TaskListResponse,
    Error,
    UpdateListPayload,
    { previous: TaskList | null }
  >({
    mutationFn: (payload) => channelListsApi.update(listUuid, payload),
    meta: { silentError: true },

    onMutate: (payload) => {
      let previous: TaskList | null = null;
      for (const [, data] of queryClient.getQueriesData<TaskListResponse>({
        queryKey: channelsQueries.taskListDetailOf(listUuid),
      })) {
        if (data) {
          previous = data.data;
          break;
        }
      }
      if (previous) {
        upsertListCaches(queryClient, channelUuid, {
          ...previous,
          ...(payload.title !== undefined ? { title: payload.title } : {}),
          ...(payload.description !== undefined
            ? { description: payload.description }
            : {}),
        });
      }
      return { previous };
    },

    onError: (_error, _payload, context) => {
      if (context?.previous) {
        upsertListCaches(queryClient, channelUuid, context.previous);
      }
    },

    onSuccess: (response) =>
      upsertListCaches(queryClient, channelUuid, response.data),
  });
}

/** Delete a list (creator or governance). Optimistic drop, rollback on error. */
export function useDeleteList(channelUuid: string, listUuid: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof channelListsApi.remove>>,
    Error,
    void,
    { previous: TaskList | null }
  >({
    mutationFn: () => channelListsApi.remove(listUuid),
    meta: { silentError: true },

    onMutate: () => {
      let previous: TaskList | null = null;
      for (const [, data] of queryClient.getQueriesData<TaskListResponse>({
        queryKey: channelsQueries.taskListDetailOf(listUuid),
      })) {
        if (data) {
          previous = data.data;
          break;
        }
      }
      removeListCaches(queryClient, channelUuid, listUuid);
      return { previous };
    },

    onError: (_error, _void, context) => {
      if (context?.previous) {
        upsertListCaches(queryClient, channelUuid, context.previous);
      } else {
        void queryClient.invalidateQueries({
          queryKey: channelsQueries.taskListsOf(channelUuid),
        });
      }
    },
  });
}

/* ── List items ───────────────────────────────────────────────────────────── */

/** Append an item; a temp row reconciles onto the server's on success. */
export function useAddListItem(channelUuid: string, listUuid: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof channelListsApi.addItem>>,
    Error,
    AddListItemPayload,
    { localUuid: string }
  >({
    mutationFn: (payload) => channelListsApi.addItem(listUuid, payload),

    onMutate: (payload) => {
      const localUuid = `${LOCAL_ITEM_PREFIX}${(localItemCounter += 1)}`;
      patchListItems(queryClient, channelUuid, listUuid, (items) => [
        ...items,
        {
          uuid: localUuid,
          content: payload.content,
          position: items.length,
          is_checked: false,
          checked_at: null,
          is_ai: false,
          creator: actingUser(),
          checked_by: null,
          created_at: new Date().toISOString(),
        },
      ]);
      return { localUuid };
    },

    onError: (_error, _payload, context) => {
      if (!context) return;
      patchListItems(queryClient, channelUuid, listUuid, (items) =>
        items.filter((item) => item.uuid !== context.localUuid),
      );
    },

    onSuccess: (response, _payload, context) => {
      patchListItems(queryClient, channelUuid, listUuid, (items) =>
        items.map((item) =>
          item.uuid === context?.localUuid ? response.data : item,
        ),
      );
    },
  });
}

export interface UpdateListItemVariables {
  itemUuid: string;
  content?: string;
  is_checked?: boolean;
}

/** Edit / check an item — the row moves optimistically, `checked_by` stamps
 *  the acting user so the identity is right before the server confirms. */
export function useUpdateListItem(channelUuid: string, listUuid: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof channelListsApi.updateItem>>,
    Error,
    UpdateListItemVariables,
    { previous: TaskListItem | null }
  >({
    mutationFn: ({ itemUuid, content, is_checked }) =>
      channelListsApi.updateItem(listUuid, itemUuid, { content, is_checked }),

    onMutate: ({ itemUuid, content, is_checked }) => {
      let previous: TaskListItem | null = null;
      const me = actingUser();
      const checkedAt = new Date().toISOString();
      patchListItems(queryClient, channelUuid, listUuid, (items) =>
        items.map((item) => {
          if (item.uuid !== itemUuid) return item;
          previous = item;
          const next: TaskListItem = { ...item };
          if (content !== undefined) next.content = content;
          if (is_checked === true) {
            next.is_checked = true;
            next.checked_at = checkedAt;
            next.checked_by = me;
          } else if (is_checked === false) {
            next.is_checked = false;
            next.checked_at = null;
            next.checked_by = null;
          }
          return next;
        }),
      );
      return { previous };
    },

    onError: (_error, { itemUuid }, context) => {
      const previous = context?.previous;
      if (!previous) return;
      patchListItems(queryClient, channelUuid, listUuid, (items) =>
        items.map((item) => (item.uuid === itemUuid ? previous : item)),
      );
    },

    onSuccess: (response) => {
      patchListItems(queryClient, channelUuid, listUuid, (items) =>
        items.map((item) =>
          item.uuid === response.data.uuid ? response.data : item,
        ),
      );
    },
  });
}

/** Remove an item; optimistic drop with a positional rollback. */
export function useDeleteListItem(channelUuid: string, listUuid: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof channelListsApi.removeItem>>,
    Error,
    string,
    { previous: TaskListItem | null; index: number }
  >({
    mutationFn: (itemUuid) => channelListsApi.removeItem(listUuid, itemUuid),

    onMutate: (itemUuid) => {
      let previous: TaskListItem | null = null;
      let index = -1;
      patchListItems(queryClient, channelUuid, listUuid, (items) => {
        index = items.findIndex((item) => item.uuid === itemUuid);
        if (index === -1) return items;
        previous = items[index];
        return items.filter((item) => item.uuid !== itemUuid);
      });
      return { previous, index };
    },

    onError: (_error, _itemUuid, context) => {
      const previous = context?.previous;
      if (!previous) return;
      patchListItems(queryClient, channelUuid, listUuid, (items) => {
        const next = [...items];
        next.splice(Math.min(context.index, next.length), 0, previous);
        return next;
      });
    },
  });
}

/** Reorder — the FULL ordered uuid set exactly once (else 422); positions are
 *  rewritten `0..n-1` optimistically and reconciled with the server array. */
export function useReorderListItems(channelUuid: string, listUuid: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof channelListsApi.reorderItems>>,
    Error,
    string[],
    { previous: TaskListItem[] | null }
  >({
    mutationFn: (item_uuids) =>
      channelListsApi.reorderItems(listUuid, { item_uuids }),

    onMutate: (item_uuids) => {
      let previous: TaskListItem[] | null = null;
      patchListItems(queryClient, channelUuid, listUuid, (items) => {
        previous = items;
        const byUuid = new Map(items.map((item) => [item.uuid, item]));
        return item_uuids
          .map((uuid) => byUuid.get(uuid))
          .filter((item): item is TaskListItem => item !== undefined)
          .map((item, index) => ({ ...item, position: index }));
      });
      return { previous };
    },

    onError: (_error, _uuids, context) => {
      const previous = context?.previous;
      if (!previous) return;
      patchListItems(queryClient, channelUuid, listUuid, () => previous);
    },

    onSuccess: (response) => {
      patchListItems(queryClient, channelUuid, listUuid, () => response.data);
    },
  });
}

/* ── Files ────────────────────────────────────────────────────────────────── */

/** Upload (multipart, 15 MB, content-sniffed). Success prepends the file into
 *  the library caches; the pending row is the tab's local state. */
export function useUploadChannelFile(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => channelFilesApi.upload(channelUuid, file),
    meta: { silentError: true },
    onSuccess: (response) => {
      // Through the shared writer so the id-dedupe against a raced
      // `.file.changed` broadcast holds.
      addFileCache(queryClient, channelUuid, response.data);
    },
  });
}

/** Delete a file (uploader or governance); optimistic drop + rollback. */
export function useDeleteChannelFile(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof channelFilesApi.remove>>,
    Error,
    number,
    { snapshots: [readonly unknown[], unknown][] }
  >({
    mutationFn: (id) => channelFilesApi.remove(channelUuid, id),

    onMutate: (id) => {
      const snapshots = queryClient.getQueriesData({
        queryKey: channelsQueries.filesOf(channelUuid),
      });
      removeFileCache(queryClient, channelUuid, id);
      return { snapshots: [...snapshots] };
    },

    onError: (_error, _id, context) => {
      for (const [queryKey, data] of context?.snapshots ?? []) {
        if (data !== undefined) queryClient.setQueryData(queryKey, data);
      }
    },
  });
}

/** Fetch the member-gated signed URL and open it — the download action. */
export function useDownloadChannelFile() {
  return useMutation({
    mutationFn: (id: number) => filesApi.getDownloadUrl(id),
    onSuccess: (data) => {
      if (data.data?.url) window.open(data.data.url, '_blank', 'noopener');
    },
  });
}
