'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { getErrorMessage } from '@/v2/runtime/query';
import { foldersApi } from '../api';
import {
  FOLDER_ITEM_INVALIDATES,
  folderItemScopeId,
  type FolderItemTarget,
} from '../item-mutations';
import type { FolderRecord } from '../types';

/**
 * create-and-add.ts — the picker's last row, as a mutation: make a folder and
 * file the item into it in ONE gesture.
 *
 * ── WHY IT IS NOT IN `folder-mutations.ts` ─────────────────────────────────
 * That module owns the folder screens' own create / rename / delete. This is a
 * different act with a different failure surface: two requests that must be
 * reported as one outcome, raised from a picker that is on screen at the time.
 * Sharing a hook would force one of the two callers to explain the other's
 * behaviour. They share the only thing worth sharing — `foldersApi.create`.
 *
 * ── EVERY NEW FOLDER IS PRIVATE, WITH NO TOGGLE ────────────────────────────
 * Owner decision 3. v1 created folders PUBLIC by default, which listed a
 * client-matter name to strangers. `is_private: true` is sent explicitly so the
 * server is never left guessing at a default.
 *
 * ── NOT OPTIMISTIC, AND CORRECTLY SO ───────────────────────────────────────
 * A folder that does not exist yet has no uuid, no slug and no timestamps; a
 * row for it cannot be fabricated, only invented. So this waits, the create row
 * shows that it is working, and `meta.invalidates` brings back the real row.
 *
 * ── THE HALF-SUCCESS IS A RESULT, NOT AN EXCEPTION ─────────────────────────
 * If the folder is created and the add then fails, throwing would report "could
 * not create the folder" about a folder that now exists. Instead the mutation
 * RESOLVES with `status: 'created-not-added'`, so `meta.invalidates` still runs
 * (the new folder is real and every list must show it) and the picker can say
 * exactly what happened and let the reader press the now-visible folder again.
 */

export type CreateAndAddResult =
  | { status: 'added'; folder: FolderRecord }
  | { status: 'created-not-added'; folder: FolderRecord; message: string };

export interface CreateAndAddVariables {
  /** The typed name, already trimmed by the caller. */
  name: string;
  /** uuid of the folder being browsed, or `null` to create at the root. */
  parentUuid: string | null;
}

export function useCreateFolderAndAdd(
  target: FolderItemTarget,
): UseMutationResult<CreateAndAddResult, Error, CreateAndAddVariables> {
  return useMutation({
    mutationFn: async ({
      name,
      parentUuid,
    }: CreateAndAddVariables): Promise<CreateAndAddResult> => {
      const created = await foldersApi.create({
        name,
        is_private: true,
        ...(parentUuid ? { parent_id: parentUuid } : {}),
      });
      const folder = created.data;
      try {
        await foldersApi.addItem(folder.uuid, {
          type: target.type,
          id: target.contentId,
        });
        return { status: 'added', folder };
      } catch (error) {
        return { status: 'created-not-added', folder, message: getErrorMessage(error) };
      }
    },
    // The same scope as every other write to this item's membership, so a
    // create-and-add queues behind an add that is still in flight. Imported,
    // not retyped: a second copy of that template literal would be a second
    // lane wearing the same name.
    scope: { id: folderItemScopeId(target) },
    meta: {
      // The picker is on screen and renders both outcomes itself.
      silentError: true,
      invalidates: FOLDER_ITEM_INVALIDATES,
    },
    // NOTHING IS WRITTEN INTO A CACHE BY HAND. The create response carries no
    // `children` and no `parent` (17 keys, not 19), so it must never seed a
    // detail entry; the invalidation above is the only honest way the new
    // folder reaches the caches.
  });
}
