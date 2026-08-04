'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { extractApiError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { foldersApi } from './api';
import { foldersQueries } from './queries';
import type { FolderCreateInput, FolderEnvelope } from './types';

/**
 * folder-mutations — every write that changes a FOLDER itself: create, rename,
 * delete. (Adding and removing ITEMS lives in `item-mutations.ts`, which the
 * picker owns.)
 *
 * ── INVALIDATE, NEVER WRITE THE RESPONSE INTO A DETAIL ──────────────────────
 * A create or update response is the 17-key my-folders shape: it carries NO
 * `parent` and NO `children` (probed — see `types.ts`). Writing it into
 * `foldersQueries.detail()` would therefore ERASE the subfolder rows of the
 * folder that was just renamed, and no refetch is scheduled to bring them back
 * because the cache would look freshly written. So these mutations declare what
 * they dirtied through `meta.invalidates` — the house's one invalidation
 * channel — and write nothing by hand. The cost is one refetch of the screen
 * the user is looking at; the alternative is a folder that appears to have lost
 * its children.
 *
 * Both `lists()` and `details()` are invalidated by all three writes, because a
 * folder appears in BOTH shapes: a rename shows up in its parent's `children`
 * array and in its own row, and a rename also rewrites every descendant's
 * `slug_path` (probed), which is what the breadcrumb counts.
 *
 * Errors ride the global `MutationCache.onError` toast — one error channel for
 * every v2 mutation. Always `mutate`, never `mutateAsync` (standards §2).
 */

/**
 * The key every folder DELETE is registered under, so the set of in-flight
 * deletes can be read declaratively by any list that must not paint their rows.
 */
export const FOLDER_DELETE_MUTATION_KEY = ['folders', 'delete'] as const;

/** What a delete addresses. Both fields are in the VARIABLES, not only in a
 *  hook's closure, because that is what makes them readable after the fact —
 *  TanStack exposes variables through `useMutationState` and to its own error
 *  callback, never a closure. The name is carried so a failure can say WHICH
 *  folder failed, on a screen the reader may have left by then. */
export interface DeleteFolderVariables {
  uuid: string;
  name: string;
}

/** The facts the undo toast needs to describe what it is doing. */
export interface DeletableFolder {
  uuid: string;
  name: string;
  itemsCount: number;
  childrenCount: number;
}

/* ── Create ───────────────────────────────────────────────────────────────── */

/**
 * Create a folder — root when `parent_id` is omitted, a subfolder when it names
 * one. The form sends exactly two fields plus the parent: v2 mints no icon and
 * no colour (decision 2) and every folder is created PRIVATE with no toggle in
 * the UI (decision 3 — v1 created them public, which listed client-matter names
 * to strangers).
 */
export function useCreateFolder() {
  return useMutation<FolderEnvelope, Error, FolderCreateInput>({
    mutationFn: (input) => foldersApi.create(input),
    meta: {
      invalidates: [foldersQueries.lists(), foldersQueries.details()],
    },
  });
}

/* ── Rename ───────────────────────────────────────────────────────────────── */

/**
 * Rename one folder. The endpoint also re-parents (`parent_id`), which v2 does
 * not offer this wave — there is no move UI, so this hook sends the name and
 * nothing else rather than a field no screen can produce.
 */
export function useRenameFolder(uuid: string) {
  return useMutation<FolderEnvelope, Error, { name: string }>({
    mutationFn: ({ name }) => foldersApi.update(uuid, { name }),
    // Serialise renames of ONE folder while renames of different folders stay
    // parallel — the last write is the last one the server sees.
    scope: { id: `folder-rename-${uuid}` },
    meta: {
      invalidates: [foldersQueries.lists(), foldersQueries.details()],
    },
  });
}

/* ── Delete ───────────────────────────────────────────────────────────────── */

/**
 * The raw delete. Soft server-side, and it CASCADES to every descendant folder;
 * the items filed inside are unfiled, not destroyed (probed A→B→C restore round
 * trip). Prefer {@link useDeleteFolderWithUndo}, which is what the screens
 * press — this is the write it eventually performs.
 *
 * The folder's own cache entries are REMOVED rather than left to expire: there
 * is no truthful value to keep, and a stale entry would paint the folder for a
 * beat if anything navigated to it before the lists settled.
 *
 * ── ITS FAILURE TOAST IS ITS OWN (`silentError`) ────────────────────────────
 * This request goes out SIX SECONDS after the press, by which time the reader
 * is usually somewhere else. The global error channel would raise the API's
 * bare sentence ("Resource not found.") with nothing to attach it to. So this
 * one mutation opts out and names the folder itself — the one case where the
 * house's single error channel cannot say enough, and the exception is spelled
 * out here rather than assumed.
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();

  return useMutation<{ success: boolean; message: string }, Error, DeleteFolderVariables>({
    mutationKey: FOLDER_DELETE_MUTATION_KEY,
    mutationFn: ({ uuid }) => foldersApi.remove(uuid),
    // NO `scope`. A scope serialises writes to ONE entity, and the entity here
    // is in the variables rather than the hook's closure — a shared scope id
    // would queue deletes of DIFFERENT folders behind each other for no reason.
    // Two deletes of the same folder cannot race either: the second press is
    // impossible while the first hides the row.
    meta: {
      silentError: true,
      invalidates: [foldersQueries.lists(), foldersQueries.details()],
    },
    onError: (error, { name }) => {
      toast.error(`Couldn’t delete “${name}”`, {
        description: extractApiError(error).message,
      });
    },
    onSuccess: (_result, { uuid }) => {
      queryClient.removeQueries({
        queryKey: foldersQueries.detail({ uuid, viewerId }).queryKey,
      });
      queryClient.removeQueries({
        queryKey: [...foldersQueries.itemLists(), uuid],
      });
    },
  });
}

/* ── The undo window ──────────────────────────────────────────────────────── */

/**
 * ── WHY THIS IS A DEFERRED SEND AND NOT AN OPTIMISTIC ROLLBACK ──────────────
 *
 * Decision 6 says undo, not confirm. The study's argument for it was that the
 * server has a RESTORE endpoint — but v2's wire layer deliberately ships no
 * `restore` call this wave (`api.ts`), so an "Undo" pressed after the DELETE has
 * been sent could only put the row back in the CACHE while the folder stayed
 * deleted on the server: the row would reappear, then vanish again on the next
 * refetch, and the reader would believe they had recovered a folder that is
 * gone. That toast would be a lie, and the brief forbids shipping it.
 *
 * So the undo window is placed BEFORE the request instead of after it. Pressing
 * delete hides the row and starts a {@link UNDO_WINDOW_MS} timer; "Undo" cancels
 * a request that has not been made. The promise the toast makes is therefore
 * exactly the operation this code performs — no restore endpoint required, and
 * no claim about the server that is not already true.
 *
 * THE COST, STATED PLAINLY AND NOT PAPERED OVER. If the tab is closed or
 * reloaded inside the window, the DELETE never goes out and the folder is still
 * there on the next visit. That is the safe direction to fail — nothing is
 * lost, and deleting again costs one press — whereas a lying undo has no safe
 * direction at all.
 *
 * THERE IS NO UNLOAD FLUSH, deliberately. An earlier version committed the
 * queue on `pagehide` and on the tab being hidden. Both were wrong: `pagehide`
 * CANNOT deliver this write (it goes out through axios/XHR, which the browser
 * aborts on unload — only `sendBeacon`, which is POST-only, or a `keepalive`
 * fetch survives, and building a second authenticated wire path beside
 * `api.ts` to save six seconds is not a trade this feature should make), and
 * the visibility flush silently ATE the undo window: a glance at another tab,
 * a minimise, an app switch or a screen lock — near-guaranteed on a phone —
 * committed the delete and dismissed the Undo with it. The window is now six
 * real seconds on the page the reader is looking at, and nothing else.
 */
export const UNDO_WINDOW_MS = 6000;

/** Frozen empty set, so "nothing scheduled" is one stable reference. */
const NO_SCHEDULED: ReadonlySet<string> = new Set<string>();

/** The snapshot `useSyncExternalStore` reads — replaced only when it changes,
 *  so subscribers never loop (the `header-context.ts` idiom). */
let scheduledUuids: ReadonlySet<string> = NO_SCHEDULED;

/** uuid → the timer and the write it will make. */
const scheduled = new Map<
  string,
  { timer: ReturnType<typeof setTimeout>; commit: () => void }
>();

const listeners = new Set<() => void>();

function emit(): void {
  scheduledUuids = scheduled.size === 0 ? NO_SCHEDULED : new Set(scheduled.keys());
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): ReadonlySet<string> {
  return scheduledUuids;
}

function getServerSnapshot(): ReadonlySet<string> {
  return NO_SCHEDULED;
}

/**
 * Queue one folder's delete. Deliberately module-level, NOT component state:
 * deleting the folder you are looking at navigates away from it, and a timer
 * owned by that screen would die with it — the delete would silently never
 * happen.
 */
function scheduleFolderDelete(uuid: string, commit: () => void): void {
  const existing = scheduled.get(uuid);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    // COMMIT FIRST, then leave the queue. TanStack registers the mutation as
    // `pending` synchronously inside `commit()`, so doing it in this order
    // means the in-flight half of `useHiddenFolderUuids` is already true
    // before the queued half turns false — the row cannot flash back into the
    // list between the two store updates, whatever React batches.
    commit();
    scheduled.delete(uuid);
    emit();
  }, UNDO_WINDOW_MS);
  scheduled.set(uuid, { timer, commit });
  emit();
}

/** Cancel a queued delete. `false` means it had already been sent — the caller
 *  must then say so rather than claim a recovery it did not perform. */
function cancelFolderDelete(uuid: string): boolean {
  const entry = scheduled.get(uuid);
  if (!entry) return false;
  clearTimeout(entry.timer);
  scheduled.delete(uuid);
  emit();
  return true;
}

/** The folders whose delete is queued but not yet sent. */
function useScheduledFolderDeletes(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Narrow a mutation's `variables` (typed `unknown` at the `useMutationState`
 * boundary) to a delete target, or `null`. A real runtime guard, not a cast.
 */
function deleteTargetUuid(variables: unknown): string | null {
  if (typeof variables !== 'object' || variables === null) return null;
  const candidate = variables as Partial<DeleteFolderVariables>;
  return typeof candidate.uuid === 'string' && candidate.uuid ? candidate.uuid : null;
}

/**
 * Every folder a list must NOT paint: queued for delete, or with its DELETE in
 * flight.
 *
 * BOTH HALVES ARE NEEDED, and the second one is not defensive noise. When the
 * timer fires the uuid leaves the scheduled set, and if nothing else hid the row
 * it would flash back into the list for the length of the request before the
 * invalidation removed it again — the exact flicker `usePendingBookmarkRemovals`
 * exists to kill on `/bookmarks`. TanStack keeps a mutation `pending` until its
 * own success-invalidation (and the refetch it triggers) has settled, so the row
 * is released at the first moment the cache is authoritative about it. A FAILED
 * delete leaves both sets, so the row comes back — which is the truth, and the
 * global error toast says why.
 */
export function useHiddenFolderUuids(): ReadonlySet<string> {
  const queued = useScheduledFolderDeletes();
  const inFlight = useMutationState({
    filters: { mutationKey: FOLDER_DELETE_MUTATION_KEY, status: 'pending' },
    select: (mutation) => deleteTargetUuid(mutation.state.variables),
  });

  return useMemo(() => {
    const sending = inFlight.filter((uuid): uuid is string => uuid !== null);
    if (queued.size === 0 && sending.length === 0) return NO_SCHEDULED;
    return new Set([...queued, ...sending]);
  }, [queued, inFlight]);
}

/** The undo window in whole seconds — used in the copy, so the number the
 *  reader is given can never drift from the timer they are racing. */
const UNDO_WINDOW_SECONDS = Math.round(UNDO_WINDOW_MS / 1000);

/**
 * What the toast SAYS, built from what is provably true of this folder AND of
 * the mechanism underneath it.
 *
 * THE FIRST SENTENCE IS ABOUT THE CODE, not about the folder: nothing has been
 * sent yet, and the reader has a stated number of seconds in which that stays
 * true. Saying "Deleted" would claim a request that has not happened, and
 * offering "Undo" with no window would leave the reader guessing how long they
 * have.
 *
 * The rest is probed: the delete cascades to every descendant folder, and
 * everything FILED inside is unfiled rather than destroyed (a restore brought a
 * whole subtree and its items back). The study is emphatic about that last
 * sentence — a container's deletion must never read like the destruction of
 * what was in it — and it names all four types v2 files, files included.
 */
function deleteDescription(folder: DeletableFolder): string {
  const parts: string[] = [`${UNDO_WINDOW_SECONDS} seconds to undo.`];
  if (folder.childrenCount > 0) {
    parts.push(
      folder.childrenCount === 1
        ? 'The subfolder inside goes with it.'
        : `The ${folder.childrenCount} subfolders inside go with it.`,
    );
  }
  if (folder.itemsCount > 0) {
    parts.push(
      'Nothing filed inside is deleted — those cases, statutes, notes and files stay in your library.',
    );
  }
  return parts.join(' ');
}

/**
 * Delete a folder with a real undo — the press screens make.
 *
 * Returns a stable callback so a row's menu can hand it a folder and nothing
 * else. The row disappears in the same frame (it is in the hidden set), the
 * toast holds the window open, and the write goes out when the window closes.
 */
export function useDeleteFolderWithUndo(): (folder: DeletableFolder) => void {
  const deleteFolder = useDeleteFolder();
  const send = deleteFolder.mutate;

  return useCallback(
    (folder: DeletableFolder) => {
      const toastId = `folder-delete-${folder.uuid}`;
      const name = folder.name.trim() || 'this folder';

      scheduleFolderDelete(folder.uuid, () => {
        // Dismissed BY the commit, not by a duration: sonner pauses a toast's
        // own timer while it is hovered or the window is unfocused, so without
        // this an "Undo" button could outlive the request it claims to stop.
        toast.dismiss(toastId);
        send({ uuid: folder.uuid, name });
      });

      // FUTURE TENSE, because that is the truth for the next six seconds: the
      // row is gone from the screen and nothing has been sent.
      toast(`“${name}” will be deleted`, {
        id: toastId,
        description: deleteDescription(folder),
        duration: UNDO_WINDOW_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            if (cancelFolderDelete(folder.uuid)) {
              toast.success(`“${name}” was kept`, {
                description: 'Nothing was sent — the folder never left.',
              });
            } else {
              // Unreachable while the commit dismisses this toast — kept
              // because the alternative is claiming a recovery that did not
              // happen.
              toast.error(`“${name}” has already been deleted`);
            }
          },
        },
      });
    },
    [send],
  );
}
