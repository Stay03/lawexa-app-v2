'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, FolderOutput, Trash2 } from 'lucide-react';

import type { Space, SpaceFile } from '@/types/collab';
import { bulkApi } from '@/v2/features/bulk/api';
import { BulkBar, BulkBarAction } from '@/v2/features/bulk/BulkBar';
import { BulkConfirm } from '@/v2/features/bulk/BulkConfirm';
import { countOf, type BulkItemId } from '@/v2/features/bulk/model';
import { useBulkAction, useBulkSelection } from '@/v2/features/bulk/use-bulk-selection';
import { foldersQueries } from '@/v2/features/folders/queries';
import { invalidateSpaceContents } from '../../content-mutations';
import { canDeleteSpaceFile } from '../../content-model';
import { spaceFileIdOf, spaceFilesBulkActions } from './space-files-bulk-model';

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
 * One bulk request per action (`POST /bulk/space-items`), 50 files at a time;
 * the answer is told as one sentence, and the files that failed stay ticked.
 * Remove and Delete ask first, with the count.
 */

const NOUN = { one: 'file', many: 'files' };

type Confirm = 'remove' | 'delete' | null;

export function useSpaceFilesBulk({
  space,
  files,
  canRemove,
  viewerId,
}: {
  space: Pick<Space, 'uuid' | 'name' | 'my_content_role'>;
  files: readonly SpaceFile[];
  canRemove: boolean;
  viewerId: number | null;
}) {
  const keys = useMemo(() => files.map((file) => file.id), [files]);
  const select = useBulkSelection<number>(keys);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const queryClient = useQueryClient();

  const ticked = [...select.selection];
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
  // reader's own files, which the Folders page lists.
  const refresh = () => {
    void invalidateSpaceContents(queryClient, space.uuid);
    void queryClient.invalidateQueries({ queryKey: foldersQueries.looseFilesKey() });
  };
  const keepFailed = (ids: ReadonlyArray<BulkItemId>) =>
    select.keepOnly(ids.flatMap((id) => {
      const file = spaceFileIdOf(id);
      return file === null ? [] : [file];
    }));

  const copy = useBulkAction({ verb: { past: 'Copied', pastLower: 'copied', after: 'into your own files' }, noun: NOUN, onSettled: refresh, keepFailed });
  const remove = useBulkAction({ verb: { past: 'Removed', pastLower: 'removed', after: `from ${space.name}` }, noun: NOUN, onSettled: refresh, keepFailed });
  const destroy = useBulkAction({ verb: { past: 'Deleted', pastLower: 'deleted' }, noun: NOUN, onSettled: refresh, keepFailed });
  const busy = copy.isPending || remove.isPending || destroy.isPending;
  const off = select.count === 0 || busy;

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
      noun={NOUN}
    >
      <BulkBarAction
        icon={Copy}
        label="Save copies to my files"
        disabled={off}
        onClick={() => copy.mutate(() => bulkApi.spaceFiles(space.uuid, ticked, 'copy_to_mine'))}
      />
      {offered.has('remove') ? (
        <BulkBarAction icon={FolderOutput} label="Remove from space" disabled={off} onClick={() => setConfirm('remove')} />
      ) : null}
      {offered.has('delete') ? (
        <BulkBarAction icon={Trash2} label="Delete" destructive disabled={off} onClick={() => setConfirm('delete')} />
      ) : null}
    </BulkBar>
  ) : null;

  const close = { onSettled: () => setConfirm(null) };
  const dialogs = (
    <>
      <BulkConfirm
        open={confirm === 'remove'}
        onOpenChange={(open) => setConfirm(open ? 'remove' : null)}
        title={`Remove ${countOf(select.count, NOUN)} from this space?`}
        description={`This takes them out of ${space.name}, so members no longer see them here. They are not deleted: a space's file belongs to the space, so each moves to your own files.`}
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() => remove.mutate(() => bulkApi.spaceFiles(space.uuid, ticked, 'remove'), close)}
      />
      <BulkConfirm
        open={confirm === 'delete'}
        onOpenChange={(open) => setConfirm(open ? 'delete' : null)}
        title={`Delete ${countOf(deletable || select.count, NOUN)}?`}
        description={
          deletable < select.count
            ? `They are deleted from ${space.name} for every member. ${countOf(select.count - deletable, NOUN)} you may not delete will stay. A copy anyone saved to their own files stays.`
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
    startButton,
    bar,
    dialogs,
  };
}
