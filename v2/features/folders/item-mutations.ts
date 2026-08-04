'use client';

import { useMemo } from 'react';
import {
  useMutation,
  useMutationState,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';

import { foldersApi } from './api';
import { foldersQueries } from './queries';
import type {
  FolderEnvelope,
  FolderItemRecord,
  FolderItemsEnvelope,
  FolderItemType,
  FolderListEnvelope,
  FolderNode,
  FolderRecord,
} from './types';

/**
 * item-mutations.ts — the two writes that put a case, a statute, a note or a
 * file INTO a folder and take it back out. Folder create/rename/delete are a
 * different concern and live in `folder-mutations.ts`.
 *
 * ── ONE SCOPE PER ITEM, NOT PER FOLDER ──────────────────────────────────────
 * Every mutation here is scoped by the CONTENT being filed
 * (`folder-item-case-11837`), so everything that touches one item's folder
 * membership is serialised — an add, its undo, a removal, and the removal's
 * undo can never overlap each other — while two different items move in
 * parallel. Scoping by FOLDER instead would queue a second removal behind the
 * first, and a queued mutation does not run `onMutate` until it is dequeued, so
 * the second row would sit there un-removed until the first request came back.
 *
 * ── THE ADD IS OPTIMISTIC IN THE ONE PLACE IT HONESTLY CAN BE ───────────────
 * There is no cached "which folders hold this item" anywhere (the reverse
 * lookup does not exist on the wire — it is a filed backend ask), so nothing on
 * a case/statute/note screen can be flipped. What CAN be moved truthfully is
 * the destination folder's `items_count`, which the picker is showing at that
 * moment. So the count moves by ±1 immediately and the row the reader is
 * looking at ticks; everything else waits for `meta.invalidates`.
 *
 * ── REMOVAL IS PROVABLY NON-DESTRUCTIVE ─────────────────────────────────────
 * `DELETE /folders/{uuid}/items` unfiles; the case/note/statute/file itself is
 * untouched (probed), and re-posting the same pair puts it straight back. That
 * is what licenses an UNDO toast here instead of a confirm dialog: the toast
 * promises exactly the request its action performs. The one thing it does NOT
 * restore is the original `added_at` — a re-add is a new row, so the item comes
 * back at the TOP of the folder rather than where it sat. The toast never
 * claims otherwise.
 *
 * ── A DUPLICATE IS NOT AN ERROR ─────────────────────────────────────────────
 * Adding something the folder already holds answers 422 with
 * `"This item is already in the folder."` and `errors: null`. That is an
 * ANSWER, not a failure, and {@link isAlreadyInFolder} is how a caller tells it
 * apart from a real validation 422 (which always carries a populated `errors`
 * object — probed both ways). The picker renders it as a state on the row.
 *
 * Always `mutate`, never `mutateAsync` (standards §2).
 */

/** What both endpoints answer with. `addItem` also returns the created row; v2 does not read it. */
export interface FolderItemWriteResponse {
  success: boolean;
  message: string;
}

/** WHAT is being filed: one of the four v2 types, and that content's own id. */
export interface FolderItemTarget {
  type: FolderItemType;
  /** The CONTENT id (`case.id`, `statute.id`, `note.id`, `item.content.id`) — never the join row's `item.id`. */
  contentId: number;
}

/** Stable identity for one filed thing — the member of the pending-removal set. */
export function folderItemKey(type: FolderItemType, contentId: number): string {
  return `${type}:${contentId}`;
}

/**
 * The serialisation scope every write to one item's folder membership shares
 * (see the header). EXPORTED because the picker's create-and-add is a third
 * write to the same membership and has to queue in the same lane — a second
 * copy of this template literal would be a second lane wearing the same name.
 */
export function folderItemScopeId({ type, contentId }: FolderItemTarget): string {
  return `folder-item-${type}-${contentId}`;
}

/** The three folder caches a membership change dirties, in ONE place. */
export const FOLDER_ITEM_INVALIDATES = [
  foldersQueries.lists(),
  foldersQueries.details(),
  foldersQueries.itemLists(),
] as const;

/**
 * Is this rejection the server saying "that folder already holds it"?
 *
 * Gated on PROOF, not on the message string: a 422 whose `errors` object is
 * absent or null. Every validation 422 from this endpoint carries a populated
 * `errors` map (`{ type: [...] }`, `{ id: [...] }` — both probed), and the
 * duplicate is the only 422 that does not.
 */
export function isAlreadyInFolder(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  if (error.response?.status !== 422) return false;
  const body = error.response.data as { errors?: unknown } | undefined;
  const errors = body?.errors;
  return errors === null || errors === undefined;
}

/* ── Cache writers: the folder counts ────────────────────────────────────── */

/** Every cached shape that carries a folder's `items_count`. */
type FolderCountCache = InfiniteData<FolderListEnvelope> | FolderEnvelope;

/**
 * What one count write actually did — the record its reversal needs.
 *
 * NOT A SNAPSHOT. A count is a DELTA, and a delta does not compose with
 * snapshot replay: two rows removed from one folder at once run in parallel, so
 * if B succeeds (its invalidation landing the server's true count) and A then
 * fails, replaying A's older whole-entry snapshot would clobber the refetched
 * page — and with it a rename from another tab, a folder created meanwhile, or
 * a sibling's optimistic edit. The same argument this file already makes for
 * the item ROWS applies to the counts, so the reversal is the same shape:
 * the INVERSE delta, written into the LIVE cache.
 *
 * `keys` holds only the entries the forward write actually MOVED, so the
 * `Math.max(0, …)` floor can never turn a clamped no-op into a spurious +1 on
 * the way back.
 */
interface FolderCountWrite {
  readonly uuid: string;
  readonly delta: number;
  readonly keys: readonly (readonly unknown[])[];
}

/**
 * Move one record's count. Returns the SAME reference when this is not the
 * target, or when the floor makes the move a no-op.
 *
 * Generic over {@link FolderNode} because a nested subfolder is a TWELVE-key
 * node, not a full record — this reads `uuid` and `items_count`, which every
 * shape carries, and gives back exactly the shape it was handed.
 */
function applyCount<T extends FolderNode>(record: T, uuid: string, delta: number): T {
  if (record.uuid !== uuid) return record;
  const next = Math.max(0, record.items_count + delta);
  if (next === record.items_count) return record;
  return { ...record, items_count: next };
}

/**
 * Move the count wherever this record can carry the target: itself, its
 * `parent` (detail payloads only) and each of its `children` (ditto). Keys the
 * payload did not send are never introduced — an absent `parent` stays absent,
 * because absence is not a value on this contract.
 */
function applyCountToRecordTree(
  record: FolderRecord,
  uuid: string,
  delta: number,
): FolderRecord {
  let next = applyCount(record, uuid, delta);

  if (record.parent) {
    const parent = applyCount(record.parent, uuid, delta);
    if (parent !== record.parent) next = { ...next, parent };
  }

  if (record.children) {
    let changed = false;
    const children = record.children.map((child) => {
      const updated = applyCount(child, uuid, delta);
      if (updated !== child) changed = true;
      return updated;
    });
    if (changed) next = { ...next, children };
  }

  return next;
}

/** Referentially stable on a no-op, so untouched entries never re-render. */
function applyCountToCache(
  cache: FolderCountCache | undefined,
  uuid: string,
  delta: number,
): FolderCountCache | undefined {
  if (!cache) return cache;

  if ('pages' in cache) {
    let changed = false;
    const pages = cache.pages.map((page) => {
      let rowsChanged = false;
      const data = page.data.map((row) => {
        const updated = applyCountToRecordTree(row, uuid, delta);
        if (updated !== row) rowsChanged = true;
        return updated;
      });
      if (!rowsChanged) return page;
      changed = true;
      return { ...page, data };
    });
    return changed ? { ...cache, pages } : cache;
  }

  const data = applyCountToRecordTree(cache.data, uuid, delta);
  return data === cache.data ? cache : { ...cache, data };
}

/** Write ±1 into every cached folder surface; report exactly what moved. */
function writeFolderItemCount(
  queryClient: QueryClient,
  uuid: string,
  delta: number,
): FolderCountWrite {
  const keys: (readonly unknown[])[] = [];
  const filters = [
    { queryKey: foldersQueries.lists() },
    { queryKey: foldersQueries.details() },
  ];

  for (const filter of filters) {
    for (const [queryKey, cache] of queryClient.getQueriesData<FolderCountCache>(
      filter,
    )) {
      const next = applyCountToCache(cache, uuid, delta);
      // Referential identity IS the "nothing happened" signal here, and it is
      // what keeps the reversal exact.
      if (next === cache) continue;
      queryClient.setQueryData(queryKey, next);
      keys.push(queryKey);
    }
  }

  return { uuid, delta, keys };
}

/** Undo one {@link writeFolderItemCount}, into the LIVE cache. */
function revertFolderItemCount(
  queryClient: QueryClient,
  write: FolderCountWrite,
): void {
  for (const queryKey of write.keys) {
    queryClient.setQueryData<FolderCountCache>(queryKey, (cache) =>
      applyCountToCache(cache, write.uuid, -write.delta),
    );
  }
}

/* ── Cache writers: the folder's item rows ───────────────────────────────── */

type FolderItemsCache = InfiniteData<FolderItemsEnvelope>;

/** Where one removed row sat, in one cache entry. */
interface RemovedItemPlacement {
  readonly queryKey: readonly unknown[];
  readonly pageIndex: number;
  readonly rowIndex: number;
  readonly row: FolderItemRecord;
}

/** The record a removal hands its mutation, so the rollback is ROW-scoped. */
interface FolderItemRemoval {
  readonly placements: readonly RemovedItemPlacement[];
}

function isRemovalTarget(
  row: FolderItemRecord,
  type: FolderItemType,
  contentId: number,
): boolean {
  return row.type === type && row.content.id === contentId;
}

/**
 * Take the row out of every cached page of that folder's items and record where
 * each copy sat.
 *
 * ROW-SCOPED, NOT A SNAPSHOT RESTORE — the `bookmarks/list-cache.ts` argument
 * applies verbatim: two rows removed at once run in parallel (different
 * content, different scopes), and replaying one mutation's whole-entry snapshot
 * would resurrect a sibling that had already been removed successfully.
 */
function removeItemFromFolderLists(
  queryClient: QueryClient,
  folderUuid: string,
  type: FolderItemType,
  contentId: number,
): FolderItemRemoval {
  const placements: RemovedItemPlacement[] = [];

  const entries = queryClient.getQueriesData<FolderItemsCache>({
    // The items key is [...itemLists(), uuid, { type }, { viewerId }], so this
    // prefix matches every type-filtered variant of ONE folder and no other.
    queryKey: [...foldersQueries.itemLists(), folderUuid],
  });

  for (const [queryKey, cache] of entries) {
    if (!cache) continue;
    let changed = false;
    const pages = cache.pages.map((page, pageIndex) => {
      const rowIndex = page.data.findIndex((row) =>
        isRemovalTarget(row, type, contentId),
      );
      if (rowIndex === -1) return page;
      placements.push({ queryKey, pageIndex, rowIndex, row: page.data[rowIndex] });
      changed = true;
      return { ...page, data: page.data.filter((_, index) => index !== rowIndex) };
    });
    if (changed) queryClient.setQueryData(queryKey, { ...cache, pages });
  }

  return { placements };
}

/** Put one placement's row back into whatever that entry holds NOW. */
function insertItemPlacement(
  cache: FolderItemsCache | undefined,
  placement: RemovedItemPlacement,
  type: FolderItemType,
  contentId: number,
): FolderItemsCache | undefined {
  // Garbage-collected, or the shape moved under us — the next fetch is authority.
  if (!cache || cache.pages.length === 0) return cache;
  // A refetch may already have brought the row back; never duplicate it.
  if (cache.pages.some((page) => page.data.some((row) => isRemovalTarget(row, type, contentId)))) {
    return cache;
  }
  const pageIndex = Math.min(placement.pageIndex, cache.pages.length - 1);
  const page = cache.pages[pageIndex];
  const rowIndex = Math.min(placement.rowIndex, page.data.length);
  const data = [
    ...page.data.slice(0, rowIndex),
    placement.row,
    ...page.data.slice(rowIndex),
  ];
  return {
    ...cache,
    pages: cache.pages.map((entry, index) =>
      index === pageIndex ? { ...page, data } : entry,
    ),
  };
}

/** Undo one {@link removeItemFromFolderLists}, into the LIVE cache. */
function reinsertRemovedItem(
  queryClient: QueryClient,
  removal: FolderItemRemoval,
  type: FolderItemType,
  contentId: number,
): void {
  for (const placement of removal.placements) {
    queryClient.setQueryData<FolderItemsCache>(placement.queryKey, (cache) =>
      insertItemPlacement(cache, placement, type, contentId),
    );
  }
}

/* ── Add ─────────────────────────────────────────────────────────────────── */

/** WHERE it is being filed. The target (WHAT) lives on the hook. */
export interface AddToFolderVariables {
  folderUuid: string;
}

export interface AddItemOptions {
  /**
   * Opt out of the global mutation-error toast, for a caller that renders the
   * outcome itself. The PICKER sets this: it is on screen when the write
   * happens, so its failures — including the 422 "already in that folder",
   * which is not a failure at all — belong on the row, not in the corner.
   */
  silentError?: boolean;
}

/**
 * File one item into one folder.
 *
 * NO SUCCESS TOAST HERE, deliberately: the two callers want different words
 * ("Added to …" from the picker; nothing at all when this is undoing a
 * removal), and a hook that toasts would force one of them to apologise for it.
 */
export function useAddItemToFolder(
  target: FolderItemTarget,
  options: AddItemOptions = {},
): UseMutationResult<
  FolderItemWriteResponse,
  Error,
  AddToFolderVariables,
  { write: FolderCountWrite }
> {
  const queryClient = useQueryClient();
  const { silentError = false } = options;

  return useMutation({
    mutationFn: ({ folderUuid }: AddToFolderVariables) =>
      foldersApi.addItem(folderUuid, { type: target.type, id: target.contentId }),
    scope: { id: folderItemScopeId(target) },
    meta: { silentError, invalidates: FOLDER_ITEM_INVALIDATES },
    onMutate: async ({ folderUuid }) => {
      // Stop in-flight folder reads before writing: a response already on the
      // wire was built before the POST, so letting it land would revert the count.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: foldersQueries.lists() }),
        queryClient.cancelQueries({ queryKey: foldersQueries.details() }),
      ]);
      return { write: writeFolderItemCount(queryClient, folderUuid, 1) };
    },
    onError: (_error, _variables, context) => {
      if (context) revertFolderItemCount(queryClient, context.write);
    },
  });
}

/* ── Remove ──────────────────────────────────────────────────────────────── */

/**
 * The removal's variables carry the TARGET as well as the folder — not because
 * the hook does not already know it, but because a mutation's `variables` are
 * the only thing `useMutationState` can read. A hook's closure is invisible to
 * it, and {@link usePendingFolderItemRemovals} has to be able to name what is
 * in flight.
 */
export interface RemoveFolderItemVariables extends FolderItemTarget {
  folderUuid: string;
  /**
   * What the undo toast names — the row's title. `null` when the payload
   * carried none (a file with no name), which the toast handles in words rather
   * than by printing an empty pair of quotes.
   */
  label: string | null;
}

/** The key every removal is registered under, so the in-flight set is readable. */
const REMOVE_FOLDER_ITEM_MUTATION_KEY = ['folders', 'item', 'remove'] as const;

/**
 * Take one item out of one folder, optimistically, with an undo.
 *
 * The row leaves every cached page of that folder's items immediately, the
 * folder's count drops by one, and a toast offers the re-add — which is a real
 * POST, not a cache trick, so the promise is kept even after the invalidation
 * has settled.
 *
 * THE TOAST IS NOT OPTIONAL, and that is deliberate. This is also what the
 * picker's own "Added to X → Undo" runs, so undoing an add answers with
 * "Removed from this folder → Undo" — a redo. Two honest sentences about two
 * things that really happened beat a flag whose only job was to keep one of
 * them quiet.
 */
export function useRemoveFolderItem(
  target: FolderItemTarget,
): UseMutationResult<
  FolderItemWriteResponse,
  Error,
  RemoveFolderItemVariables,
  { rollback: () => void }
> {
  const queryClient = useQueryClient();
  // The undo's re-add. NOT silent: an undo that quietly failed would leave the
  // reader believing the item is back. Unconditional, because this hook always
  // offers the undo — an `undoToast: false` option would have made this
  // observer dead weight on every call site that passed it.
  const readd = useAddItemToFolder(target);

  return useMutation({
    mutationKey: REMOVE_FOLDER_ITEM_MUTATION_KEY,
    mutationFn: ({ folderUuid, type, contentId }: RemoveFolderItemVariables) =>
      foldersApi.removeItem(folderUuid, { type, id: contentId }),
    scope: { id: folderItemScopeId(target) },
    meta: { invalidates: FOLDER_ITEM_INVALIDATES },
    onMutate: async ({ folderUuid, type, contentId }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: foldersQueries.itemLists() }),
        queryClient.cancelQueries({ queryKey: foldersQueries.lists() }),
        queryClient.cancelQueries({ queryKey: foldersQueries.details() }),
      ]);
      const removal = removeItemFromFolderLists(
        queryClient,
        folderUuid,
        type,
        contentId,
      );
      const counts = writeFolderItemCount(queryClient, folderUuid, -1);
      return {
        rollback: () => {
          revertFolderItemCount(queryClient, counts);
          reinsertRemovedItem(queryClient, removal, type, contentId);
        },
      };
    },
    onError: (_error, _variables, context) => {
      context?.rollback();
    },
    onSuccess: (_result, { folderUuid, label }) => {
      toast.success(
        label ? `Removed “${label}” from this folder` : 'Removed from this folder',
        {
          description: 'It was only unfiled — the original is untouched.',
          duration: 8000,
          action: {
            label: 'Undo',
            onClick: () => readd.mutate({ folderUuid }),
          },
        },
      );
    },
  });
}

/* ── The in-flight removal set ───────────────────────────────────────────── */

/** Narrow a mutation's `variables` (typed `unknown` here) to a removal, or null. */
function pendingRemoval(
  variables: unknown,
): { folderUuid: string; key: string } | null {
  if (typeof variables !== 'object' || variables === null) return null;
  const candidate = variables as Partial<RemoveFolderItemVariables>;
  if (
    typeof candidate.folderUuid !== 'string' ||
    typeof candidate.type !== 'string' ||
    typeof candidate.contentId !== 'number'
  ) {
    return null;
  }
  return {
    folderUuid: candidate.folderUuid,
    key: folderItemKey(candidate.type, candidate.contentId),
  };
}

/** Frozen empty set, so "nothing pending" is one stable reference. */
const NO_PENDING: ReadonlySet<string> = new Set<string>();

/**
 * The items of ONE folder whose removal is currently in flight — the set a
 * folder page must filter its rendered rows through.
 *
 * ── THE FLICKER THIS EXISTS TO KILL (the bookmarks lesson, restated) ────────
 * Remove A, then remove B. Different content, so different scopes, so they run
 * in PARALLEL. B settles first and the global `MutationCache.onSuccess`
 * invalidates the folder's items — and that refetch still contains A, because
 * A's DELETE has not landed. A reappears, then vanishes again: a visible
 * flicker on the most ordinary thing anyone does on this screen, which is
 * clearing several rows in a row.
 *
 * Filtering rendered rows through this set makes that impossible: while a
 * removal is in flight its row cannot be painted by anything. The window is
 * exactly right because TanStack awaits the mutation-cache `onSuccess` — and so
 * the whole invalidation — before dispatching the mutation's `success` state.
 *
 * `useMutationState` structurally shares its result, so this returns a stable
 * reference while nothing changes.
 */
export function usePendingFolderItemRemovals(folderUuid: string): ReadonlySet<string> {
  const pending = useMutationState({
    filters: { mutationKey: REMOVE_FOLDER_ITEM_MUTATION_KEY, status: 'pending' },
    select: (mutation) => pendingRemoval(mutation.state.variables),
  });

  return useMemo(() => {
    const keys = pending
      .filter((entry): entry is { folderUuid: string; key: string } => entry !== null)
      .filter((entry) => entry.folderUuid === folderUuid)
      .map((entry) => entry.key);
    return keys.length === 0 ? NO_PENDING : new Set(keys);
  }, [pending, folderUuid]);
}
