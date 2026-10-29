'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, FolderOutput, Trash2 } from 'lucide-react';

import type { Space, SpaceFile } from '@/types/collab';
import { bulkApi } from '@/v2/features/bulk/api';
import { BulkBar, BulkBarAction, BulkBarMenuItem } from '@/v2/features/bulk/BulkBar';
import { BulkConfirm } from '@/v2/features/bulk/BulkConfirm';
import { countOf, type BulkItemId } from '@/v2/features/bulk/model';
import { useBulkAction, useBulkSelection } from '@/v2/features/bulk/use-bulk-selection';
import { foldersQueries } from '@/v2/features/folders/queries';
import { invalidateSpaceContents } from '../../content-mutations';
import { canDeleteSpaceFile } from '../../content-model';
import {
  spaceFileKey,
  spaceFilesBulkActions,
  spaceFolderKey,
  spaceItemsOf,
  spaceRowKeyOf,
  type SpaceRowKey,
} from './space-files-bulk-model';

/**
 * Bulk select on a Space's files in no folder, from the Folders pill's +
 * (Arthur, 20 October 2026, on the old Files pill; part 3 with Saved): those
 * files, ticked together. The actions follow the reader's role and what is
 * ticked (`spaceFilesBulkActions`):
 *
 *   Save copies to my files   any member
 *   Remove from space         the Space's Owner (nothing is deleted)
 *   Delete                    the files the reader may delete
 *
 * THE OWNER TICKS FOLDERS TOO (Arthur, 29 October 2026, 07:05Z, thread
 * 8aa04be0: "why is there no tick in the space folder"). The pill's folders
 * had no tick at all: the list drew them with no selection, and this hook
 * held files only. For the Space's Owner, the one who may take a folder out
 * (`canRemoveFromSpace`), the folders tick with the files, and Remove from
 * space takes both out in one request. Copy and Delete stay with the files:
 * they are off while only folders are ticked. Anyone else gets no tick on a
 * folder, as no bulk action is theirs to take on one.
 *
 * One bulk request per action (`POST /bulk/space-items`), 50 files at a time;
 * the answer is told as one sentence, and the files that failed stay ticked.
 * Remove and Delete ask first, with the count.
 */

const NOUN = { one: 'file', many: 'files' };
const ITEM_NOUN = { one: 'item', many: 'items' };
const NO_FOLDERS: readonly string[] = [];

type Confirm = 'remove' | 'delete' | null;

export function useSpaceFilesBulk({
  space,
  folders = NO_FOLDERS,
  files,
  canRemove,
  viewerId,
}: {
  space: Pick<Space, 'uuid' | 'name' | 'my_content_role'>;
  /** The pill's folders the reader may tick (uuids): the Owner's alone. */
  folders?: readonly string[];
  files: readonly SpaceFile[];
  canRemove: boolean;
  viewerId: number | null;
}) {
  const keys = useMemo(
    () => [...folders.map(spaceFolderKey), ...files.map((file) => spaceFileKey(file.id))],
    [folders, files],
  );
  const select = useBulkSelection<SpaceRowKey>(keys);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const queryClient = useQueryClient();

  const tickedKeys = [...select.selection];
  const ticked = tickedKeys.filter((key) => key.startsWith('file:')).map((key) => Number(key.slice('file:'.length)));
  const tickedFolders = tickedKeys.length - ticked.length;
  const removeNoun = tickedFolders > 0 ? ITEM_NOUN : NOUN;
  const uploaderOf = new Map(files.map((file) => [file.id, file.uploader.id]));
  const role = { my_content_role: space.my_content_role ?? null };
  const deletable = ticked.filter((id) => {
    const uploader = uploaderOf.get(id);
    return uploader !== undefined && canDeleteSpaceFile(role, uploader, viewerId);
  }).length;
  const offered = new Set(
    spaceFilesBulkActions({
      ticked: ticked.length,
      deletable,
      canRemove,
      mayDelete: role.my_content_role === 'owner' || role.my_content_role === 'editor',
    }),
  );

  // The Space's lists and counts; a copy or a file taken out lands in the
  // reader's own files, and a folder taken out goes back to the person who
  // added it, which the Folders page lists.
  const refresh = () => {
    void invalidateSpaceContents(queryClient, space.uuid);
    void queryClient.invalidateQueries({ queryKey: foldersQueries.looseFilesKey() });
    if (tickedFolders > 0) void queryClient.invalidateQueries({ queryKey: foldersQueries.lists() });
  };
  const keepFailed = (ids: ReadonlyArray<BulkItemId>) =>
    select.keepOnly(ids.flatMap((id) => {
      const key = spaceRowKeyOf(id);
      return key === null ? [] : [key];
    }));

  const copy = useBulkAction({ verb: { past: 'Copied', pastLower: 'copied', after: 'into your own files' }, noun: NOUN, onSettled: refresh, keepFailed });
  const remove = useBulkAction({ verb: { past: 'Removed', pastLower: 'removed', after: `from ${space.name}` }, noun: removeNoun, onSettled: refresh, keepFailed });
  const destroy = useBulkAction({ verb: { past: 'Deleted', pastLower: 'deleted' }, noun: NOUN, onSettled: refresh, keepFailed });
  const busy = copy.isPending || remove.isPending || destroy.isPending;
  const off = select.count === 0 || busy;
  // Copy and Delete act on files: off while only folders are ticked.
  const filesOff = ticked.length === 0 || busy;

  const startButton = useCallback(
    (className: string): ReactNode => (
      <button type="button" onClick={select.start} className={className}>
        Select
      </button>
    ),
    [select.start],
  );

  const bar = select.active ? (
    <BulkBar
      count={select.count}
      total={keys.length}
      allState={select.allState}
      onToggleAll={select.toggleAll}
      onDone={select.stop}
      noun={folders.length > 0 ? ITEM_NOUN : NOUN}
      selectAllInHead
      more={
        offered.has('remove') ? (
          <BulkBarMenuItem icon={FolderOutput} label="Remove from space" disabled={off} onClick={() => setConfirm('remove')} />
        ) : undefined
      }
    >
      <BulkBarAction
        icon={Copy}
        label="Save copies to my files"
        disabled={filesOff}
        onClick={() => copy.mutate(() => bulkApi.spaceFiles(space.uuid, ticked, 'copy_to_mine'))}
      />
      {offered.has('delete') ? (
        <BulkBarAction icon={Trash2} label="Delete" destructive disabled={filesOff} onClick={() => setConfirm('delete')} />
      ) : null}
    </BulkBar>
  ) : null;

  const close = { onSettled: () => setConfirm(null) };
  const dialogs = (
    <>
      <BulkConfirm
        open={confirm === 'remove'}
        onOpenChange={(open) => setConfirm(open ? 'remove' : null)}
        title={`Remove ${countOf(select.count, removeNoun)} from this space?`}
        description={
          tickedFolders > 0
            ? `This takes them out of ${space.name}, so members no longer see them here. Nothing is deleted: a folder goes back to the person who added it, and a file moves to your own files.`
            : `This takes them out of ${space.name}, so members no longer see them here. They are not deleted: a space's file belongs to the space, so each moves to your own files.`
        }
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() => remove.mutate(() => bulkApi.spaceItemsOut(space.uuid, spaceItemsOf(tickedKeys)), close)}
      />
      <BulkConfirm
        open={confirm === 'delete'}
        onOpenChange={(open) => setConfirm(open ? 'delete' : null)}
        title={`Delete ${countOf(deletable || ticked.length, NOUN)}?`}
        description={
          deletable < ticked.length
            ? `They are deleted from ${space.name} for every member. ${countOf(ticked.length - deletable, NOUN)} you may not delete will stay. A copy anyone saved to their own files stays.`
            : `They are deleted from ${space.name} for every member. A copy anyone saved to their own files stays.`
        }
        confirmLabel="Delete"
        pending={destroy.isPending}
        onConfirm={() => destroy.mutate(() => bulkApi.spaceFiles(space.uuid, ticked, 'delete'), close)}
      />
    </>
  );

  return {
    selecting: select.active,
    isSelected: select.isSelected,
    toggle: select.toggle,
    stop: select.stop,
    start: select.start,
    startWith: select.startWith,
    headSelectAll: {
      selecting: select.active,
      state: select.allState,
      onToggle: select.active ? select.toggleAll : select.startAll,
      label: `Select all ${countOf(keys.length, folders.length > 0 ? ITEM_NOUN : NOUN)}`,
    },
    startButton,
    bar,
    dialogs,
  };
}
