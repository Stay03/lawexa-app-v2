'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { spacesApi } from '@/lib/api/collab';
import type { ContentSpaceStub } from '@/types/collab';
import { spaceFolderPayload } from '@/v2/features/spaces/content-model';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { getErrorMessage } from '@/v2/runtime/query';
import { foldersApi } from '../api';
import { filedContentId } from '../filed-content';
import {
  FOLDER_ITEM_INVALIDATES,
  folderItemScopeId,
  type FolderItemTarget,
} from '../item-mutations';
import type { PickerFolder } from './picker-model';

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
 *
 * ── IN A SPACE, THE FOLDER IS THE SPACE'S ──────────────────────────────────
 * A picker browsing one space's folders (Stay, 22 October 2026) creates there
 * too: `POST /spaces/{uuid}/folders`, the same request `FolderNameDialog`
 * sends for a space folder, so the folder is every member's and the space's
 * counts move with it.
 */

export type CreateAndAddResult =
  /** `contentId`: what was filed, from the add's 201 (`filed-content.ts`). */
  | { status: 'added'; folder: PickerFolder; contentId: number }
  | { status: 'created-not-added'; folder: PickerFolder; message: string };

export interface CreateAndAddVariables {
  /** The typed name, already trimmed by the caller. */
  name: string;
  /** uuid of the folder being browsed, or `null` to create at the root. */
  parentUuid: string | null;
}

export interface CreateAndAddOptions {
  /** Create in this space's folders (`POST /spaces/{uuid}/folders`), or
   *  omitted for one of the viewer's own. */
  space?: ContentSpaceStub;
}

/** A space folder changes the space's folder count on its detail and its row too. */
const CREATE_IN_SPACE_INVALIDATES = [
  ...FOLDER_ITEM_INVALIDATES,
  spacesQueries.details(),
  spacesQueries.lists(),
] as const;

export function useCreateFolderAndAdd(
  target: FolderItemTarget,
  options: CreateAndAddOptions = {},
): UseMutationResult<CreateAndAddResult, Error, CreateAndAddVariables> {
  const { space } = options;
  return useMutation({
    mutationFn: async ({
      name,
      parentUuid,
    }: CreateAndAddVariables): Promise<CreateAndAddResult> => {
      const folder: PickerFolder = space
        ? (await spacesApi.createFolder(space.uuid, spaceFolderPayload(name, parentUuid))).data
        : (
            await foldersApi.create({
              name,
              is_private: true,
              ...(parentUuid ? { parent_id: parentUuid } : {}),
            })
          ).data;
      try {
        const added = await foldersApi.addItem(folder.uuid, {
          type: target.type,
          id: target.contentId,
        });
        return { status: 'added', folder, contentId: filedContentId(added, target.contentId) };
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
      invalidates: space ? CREATE_IN_SPACE_INVALIDATES : FOLDER_ITEM_INVALIDATES,
    },
    // NOTHING IS WRITTEN INTO A CACHE BY HAND. The create response carries no
    // `children` and no `parent` (17 keys, not 19), so it must never seed a
    // detail entry; the invalidation above is the only honest way the new
    // folder reaches the caches.
  });
}
