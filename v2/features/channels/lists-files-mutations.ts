'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { channelFilesApi, channelListsApi } from '@/lib/api/collab';
import { filesApi } from '@/lib/api/files';
import { useAuthStore } from '@/lib/stores/authStore';
import type {
  AddListItemPayload,
  CreateListPayload,
  SlimUser,
  TaskList,
  TaskListItem,
  TaskListResponse,
  UpdateListPayload,
} from '@/types/collab';
import {
  applyFileRemovedFromMessages,
  restoreMessageAttachments,
  type MessageAttachmentsSnapshot,
} from './cache';
import {
  addFileCache,
  patchListItems,
  removeFileCache,
  removeListCaches,
  upsertListCaches,
} from './lists-files-cache';
import { LOCAL_ITEM_PREFIX } from './model';
import { channelsQueries } from './queries';
import { noteChannelFileRemoved } from './removed-files';

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

/** The acting user as a `SlimUser`, read from the sanctioned token bridge at
 *  MUTATION time (never in render). The full shape — `username` included — so
 *  an optimistic row is indistinguishable from the one the server echoes. */
function actingUser(): SlimUser | null {
  const me = useAuthStore.getState().user;
  return me
    ? {
        uuid: me.uuid ?? '',
        name: me.name,
        username: me.username ?? null,
        avatar_url: me.avatar_url,
      }
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

/** What one upload needs beyond the bytes: where to report progress, and how
 *  to be called off. */
export interface UploadChannelFileVariables {
  file: File;
  /** Bytes ON THE WIRE, not completion — the server is still storing the file
   *  when this reaches `total`. See `channelFilesApi.upload`. */
  onProgress?: (sent: number, total: number) => void;
  /** Aborts the request. Cancellation is a REJECTION like any other; the
   *  caller distinguishes it by remembering that it asked. */
  signal?: AbortSignal;
}

/**
 * What `mutate` accepts. A BARE `File` is the shorthand for "just send it" —
 * the shape a caller with nowhere to show progress and no cancel affordance
 * writes (the composer's attach). The object form is for a caller that has
 * both, and it is an object precisely because progress and cancellation must
 * ride WITH the file they belong to: a tray running four concurrent uploads
 * needs each one addressable, and a hook-level callback could not tell them
 * apart.
 */
export type UploadChannelFileInput = File | UploadChannelFileVariables;

function uploadVariables(input: UploadChannelFileInput): UploadChannelFileVariables {
  return input instanceof File ? { file: input } : input;
}

/**
 * Upload (multipart, 15 MB, content-sniffed). Success prepends the file into
 * the library caches; any in-flight row is the caller's own local state.
 *
 * ── DETERMINATE PROGRESS AND CANCEL ARE AVAILABLE HERE ────────────────────
 * The transport DOES have a progress channel and an abort path — axios's
 * `onUploadProgress` and `signal`, threaded through `channelFilesApi.upload`.
 * Any surface that shows an upload can therefore show a real percentage and
 * offer a real Cancel:
 *
 *     const controller = new AbortController();
 *     upload.mutate({ file, signal: controller.signal,
 *                     onProgress: (sent, total) => setPercent(sent / total) });
 *
 * TWO CAVEATS THAT ARE PART OF THE CONTRACT. `onProgress` measures BYTES ON
 * THE WIRE: reaching `total` means the upload is sent, not stored, so a
 * surface must not paint "done" until the promise settles (the Files tray
 * shows an indeterminate "Finishing…" for that window). And once every byte is
 * sent, aborting no longer stops anything the server is doing — offer Cancel
 * only while bytes are still moving.
 *
 * FOR CONCURRENT UPLOADS USE `mutateAsync`. One `useMutation` is ONE observer:
 * TanStack v5 overwrites the per-call `{onSuccess, onError}` on every
 * `mutate()`, so with several files in flight only the last one's callbacks
 * fire. `mutateAsync` returns a promise per call and has no such sharing.
 * `v2/features/channels/files/use-upload-queue.ts` is the worked example.
 */
export function useUploadChannelFile(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadChannelFileInput) => {
      const { file, onProgress, signal } = uploadVariables(input);
      return channelFilesApi.upload(channelUuid, file, { onProgress, signal });
    },
    meta: { silentError: true },
    onSuccess: (response) => {
      // Through the shared writer so the id-dedupe against a raced
      // `.file.changed` broadcast holds.
      addFileCache(queryClient, channelUuid, response.data);
    },
  });
}

/**
 * Delete a file (uploader or governance); optimistic drop + rollback.
 *
 * IT DELETES IN THREE PLACES BECAUSE THE BACKEND DOES. Since 2026-08-05 a file
 * can also be an attachment on a message, and removing it from the library
 * removes it from every message that carried it (measured). So the optimistic
 * write reaches the transcript — otherwise the reader deletes a file and the
 * message beside it keeps offering a chip that can only 404 — and the pins and
 * saved panels with it, which hold their own copies of those rows.
 *
 * ── THE TWO SNAPSHOTS ARE DELIBERATELY DIFFERENT SHAPES ────────────────────
 * The LIBRARY is this mutation's own list: it can be snapshotted whole, because
 * nothing else writes it during the round trip. The MESSAGE caches cannot. A
 * `message.created` can land at any moment, and restoring a whole transcript
 * entry would take that message back out of the feed until the next history
 * fetch — a stranger's message erased by our failed delete. So the message half
 * rolls back ROW BY ROW, through the snapshots
 * `applyFileRemovedFromMessages` reports.
 *
 * ── THE COMPOSER IS TOLD, AND IS NEVER UNTOLD ──────────────────────────────
 * A staged chip is a library row the composer is holding, so a delete has to
 * reach it too or the next send posts an id the server no longer has. The
 * publish happens HERE, in `onMutate`, at the same moment the library row
 * leaves — and is not reversed by `onError`. See `./removed-files.ts` for why a
 * chip the reader watched disappear must not come back.
 */
export function useDeleteChannelFile(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof channelFilesApi.remove>>,
    Error,
    number,
    {
      library: [readonly unknown[], unknown][];
      attachments: MessageAttachmentsSnapshot[];
    }
  >({
    mutationFn: (id) => channelFilesApi.remove(channelUuid, id),

    onMutate: (id) => {
      const library = queryClient.getQueriesData({
        queryKey: channelsQueries.filesOf(channelUuid),
      });
      removeFileCache(queryClient, channelUuid, id);
      const attachments = applyFileRemovedFromMessages(queryClient, channelUuid, id);
      noteChannelFileRemoved(channelUuid, id);
      return { library: [...library], attachments };
    },

    onError: (_error, _id, context) => {
      if (!context) return;
      for (const [queryKey, data] of context.library) {
        if (data !== undefined) queryClient.setQueryData(queryKey, data);
      }
      restoreMessageAttachments(queryClient, context.attachments);
    },
  });
}

/**
 * Fetch the member-gated signed URL and open it — the download action.
 *
 * THE OPEN IS PART OF THE MUTATION, not an afterthought in `onSuccess`. It runs
 * after the round trip, so it is outside the gesture's synchronous frame, and
 * iOS Safari answers that with a blocked window and a `null` return rather than
 * an exception. Discarding that return is how a download becomes a tap that
 * does nothing at all — no tab, no spinner, no reason — which is the one
 * failure a reader cannot even report. Throwing here puts it in the mutation's
 * error state, where the row can say so and offer a fresh gesture the engine
 * will honour. Same rule as the feed's attachment opener.
 */
export function useDownloadChannelFile() {
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await filesApi.getDownloadUrl(id);
      const url = response.data?.url;
      if (!url) throw new Error('The download link came back empty.');
      if (!window.open(url, '_blank', 'noopener')) {
        throw new Error('The browser blocked the new tab.');
      }
      return response;
    },
    meta: { silentError: true },
  });
}
