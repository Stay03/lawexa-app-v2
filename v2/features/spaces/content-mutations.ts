'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { spaceMovesApi, spacesApi } from '@/lib/api/collab';
import type { CreateSpaceFolderPayload, SpaceItemRef } from '@/types/collab';
import type { UploadAttempt } from '@/v2/features/channels/files/use-upload-queue';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import { foldersQueries } from '@/v2/features/folders/queries';
import { movePayload, spaceItemRef } from './content-model';
import { spacesQueries } from './queries';

/**
 * content-mutations — writing to a space's contents (Spaces F3, 12 October
 * 2026, backend B3 cb0fae8): make a folder in it, upload a file into it, take
 * an item out of it, and move an item the viewer owns into a space or back
 * out.
 *
 * ── INVALIDATE, NEVER GUESS ────────────────────────────────────────────────
 * The spaces mutations' rule (`./mutations.ts`), for the same reason: each
 * write changes what the server derives across several payloads at once (the
 * tab's list, the space's counts on its detail and on its row in `/spaces`,
 * and the item's place in its owner's own lists). So nothing is written
 * optimistically, and each write invalidates exactly the families it dirtied,
 * named in {@link invalidateSpaceContents} and {@link invalidateItemFamily}.
 * The rows on screen stay while TanStack refetches behind them.
 *
 * ── EACH `onSuccess` RETURNS ITS INVALIDATION ──────────────────────────────
 * TanStack awaits a promise returned from a mutation's `onSuccess` before the
 * mutation settles. So the dialog that waits on it closes once the list under
 * it already holds the new row, and the upload tray drops a file's row in the
 * same frame the file appears in the list, rather than a beat before.
 *
 * ── ERRORS ARE SHOWN WHERE THEY HAPPENED ───────────────────────────────────
 * Every hook is `silentError`: the refusals here are answers (a Viewer, a
 * confidential chat, an item already taken out), and each surface shows its
 * sentence in place through `content-model.ts`, never as a toast.
 */

/**
 * What any change to ONE space's contents dirties: its three lists (every
 * level and search under the one prefix), its detail (the counts), and the
 * `/spaces` rows (which say what each space holds).
 */
function invalidateSpaceContents(
  queryClient: QueryClient,
  spaceUuid: string,
): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: spacesQueries.contentsOf(spaceUuid) }),
    queryClient.invalidateQueries({ queryKey: spacesQueries.detailsOf(spaceUuid) }),
    queryClient.invalidateQueries({ queryKey: spacesQueries.lists() }),
  ]);
}

/**
 * What changes in the item's OWN family when it enters or leaves a space: a
 * chat's rows in its owner's lists and its open transcript (both carry the
 * space label), a folder's rows and detail. A file has no list of its own in
 * v2 beyond the space's, so nothing more.
 */
function invalidateItemFamily(
  queryClient: QueryClient,
  item: SpaceItemRef,
): Promise<unknown> {
  switch (item.type) {
    case 'conversation':
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: conversationsQueries.lists() }),
        queryClient.invalidateQueries({
          queryKey: [...conversationsQueries.details(), item.id],
        }),
      ]);
    case 'folder':
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: foldersQueries.lists() }),
        queryClient.invalidateQueries({ queryKey: foldersQueries.details() }),
      ]);
    case 'file':
      return Promise.resolve();
  }
}

/* ── Adding ───────────────────────────────────────────────────────────────── */

/**
 * Make a folder in the space (`POST /spaces/{uuid}/folders`). The folder is
 * the maker's own, so their folder lists re-ask too.
 */
export function useCreateSpaceFolder(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSpaceFolderPayload) =>
      spacesApi.createFolder(spaceUuid, payload),
    meta: { silentError: true },
    onSuccess: () =>
      Promise.all([
        invalidateSpaceContents(queryClient, spaceUuid),
        queryClient.invalidateQueries({ queryKey: foldersQueries.lists() }),
      ]),
  });
}

/**
 * Upload one file into the space (`POST /spaces/{uuid}/files`). Driven by the
 * shared upload queue (`useUploadQueueFor`) through `mutateAsync`, the one
 * call that keeps a promise per file when several are in flight (that hook's
 * docblock has the TanStack reason).
 */
export function useUploadSpaceFile(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress, signal }: UploadAttempt) =>
      spacesApi.uploadFile(spaceUuid, file, { onProgress, signal }),
    meta: { silentError: true },
    onSuccess: () => invalidateSpaceContents(queryClient, spaceUuid),
  });
}

/* ── Taking out ───────────────────────────────────────────────────────────── */

/**
 * Remove from Space (`DELETE /spaces/{uuid}/items`), the space's Owner only.
 * The item is not deleted: it goes back to its owner, so the owner's own
 * lists change (their label goes) as well as the space's.
 */
export function useRemoveFromSpace(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: SpaceItemRef) => spacesApi.removeItem(spaceUuid, spaceItemRef(item)),
    meta: { silentError: true },
    onSuccess: (_response, item) =>
      Promise.all([
        invalidateSpaceContents(queryClient, spaceUuid),
        invalidateItemFamily(queryClient, item),
      ]),
  });
}

/* ── Moving ───────────────────────────────────────────────────────────────── */

/** A move: the item, and the space it goes into (`null` = back out to its
 *  owner's own items). */
export interface MoveToSpaceVariables {
  item: SpaceItemRef;
  to: string | null;
}

/**
 * Move an item the viewer owns into a space, or back out. Each kind has its
 * own route (B3), and the body is the same `{space_uuid}` on all three.
 *
 * EVERY SPACE'S CONTENTS ARE INVALIDATED, not one space's: the item leaves one
 * space and enters another, and the menu that started the move may know only
 * one of them (a folder page knows neither). Only lists that are mounted
 * refetch; the rest are marked stale and re-ask on their next visit, so the
 * broad prefix costs nothing it does not need to.
 */
export function useMoveToSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ item, to }: MoveToSpaceVariables) => {
      const body = movePayload(to);
      switch (item.type) {
        case 'conversation':
          return spaceMovesApi.moveConversation(item.id, body);
        case 'folder':
          return spaceMovesApi.moveFolder(item.id, body);
        case 'file':
          return spaceMovesApi.moveFile(item.id, body);
      }
    },
    meta: { silentError: true },
    onSuccess: (_response, { item }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: spacesQueries.contents() }),
        queryClient.invalidateQueries({ queryKey: spacesQueries.details() }),
        queryClient.invalidateQueries({ queryKey: spacesQueries.lists() }),
        invalidateItemFamily(queryClient, item),
      ]),
  });
}
