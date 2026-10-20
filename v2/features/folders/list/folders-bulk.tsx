'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CornerUpRight, FolderInput, Lock, LockOpen, Trash2, Users } from 'lucide-react';

import { bulkApi } from '@/v2/features/bulk/api';
import { BulkBar, BulkBarAction } from '@/v2/features/bulk/BulkBar';
import { BulkConfirm } from '@/v2/features/bulk/BulkConfirm';
import { FolderChooser } from '@/v2/features/bulk/FolderChooser';
import { countOf, mergeResults, type BulkItemId, type BulkResult } from '@/v2/features/bulk/model';
import { useBulkAction, useBulkSelection } from '@/v2/features/bulk/use-bulk-selection';
import { MoveToSpaceDialog } from '@/v2/features/spaces/move/MoveToSpaceDialog';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { foldersQueries } from '../queries';
import { foldersBulkActions } from './folders-bulk-model';

/**
 * Bulk select on the Folders page (Arthur, 20 October 2026; part 1 with the
 * folder page): the reader's folders and their files in no folder, ticked
 * together. The actions follow what is ticked (Arthur: "keep the actions
 * context-specific"):
 *
 *   Delete, Move to a space   folders and files
 *   Move (another folder, or the top level), Make private / public   folders only
 *   Add to a folder           files only
 *
 * Each action is one bulk request per kind (`POST /bulk/folders`,
 * `POST /bulk/files`), 50 items at a time; the answers are told as one
 * sentence, and the rows that failed stay ticked. Delete asks first, with the
 * count.
 */

/** A ticked row: a folder by uuid, a file by id. */
export type FoldersKey = `folder:${string}` | `file:${number}`;
export const folderKey = (uuid: string): FoldersKey => `folder:${uuid}`;
export const fileKey = (id: number): FoldersKey => `file:${id}`;

const NOUN = { one: 'item', many: 'items' };

type Dialog = 'delete' | 'space' | 'move' | 'add' | null;

export function useFoldersBulk({ folderUuids, fileIds }: { folderUuids: readonly string[]; fileIds: readonly number[] }) {
  const keys = useMemo<FoldersKey[]>(
    () => [...folderUuids.map(folderKey), ...fileIds.map(fileKey)],
    [folderUuids, fileIds],
  );
  const select = useBulkSelection<FoldersKey>(keys);
  const [dialog, setDialog] = useState<Dialog>(null);
  const queryClient = useQueryClient();

  const ticked = [...select.selection];
  const tickedFolders = ticked.filter((key) => key.startsWith('folder:')).map((key) => key.slice('folder:'.length));
  const tickedFiles = ticked.filter((key) => key.startsWith('file:')).map((key) => Number(key.slice('file:'.length)));

  const refresh = () => {
    for (const key of [foldersQueries.lists(), foldersQueries.details(), foldersQueries.itemLists(), foldersQueries.looseFilesKey(), spacesQueries.all]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
  // A failed item comes back by its id: a folder's uuid (a string), a file's id (a number).
  const keepFailed = (ids: ReadonlyArray<BulkItemId>) =>
    select.keepOnly(
      ids.flatMap((id) => (typeof id === 'number' ? [fileKey(id)] : typeof id === 'string' ? [folderKey(id)] : [])),
    );

  const remove = useBulkAction({ verb: { past: 'Deleted', pastLower: 'deleted' }, noun: NOUN, onSettled: refresh, keepFailed });
  const toSpace = useBulkAction({ verb: { past: 'Moved', pastLower: 'moved' }, noun: NOUN, onSettled: refresh, keepFailed });
  const move = useBulkAction({ verb: { past: 'Moved', pastLower: 'moved' }, noun: NOUN, onSettled: refresh, keepFailed });
  const privacy = useBulkAction({ verb: { past: 'Changed', pastLower: 'changed' }, noun: NOUN, onSettled: refresh, keepFailed });
  const add = useBulkAction({ verb: { past: 'Added', pastLower: 'added' }, noun: { one: 'file', many: 'files' }, onSettled: refresh, keepFailed });
  const busy = remove.isPending || toSpace.isPending || move.isPending || privacy.isPending || add.isPending;

  /** Both kinds, one after the other, told as one outcome. */
  const both = async (folders: () => Promise<BulkResult> | null, files: () => Promise<BulkResult> | null) => {
    const parts: BulkResult[] = [];
    if (tickedFolders.length > 0) {
      const run = folders();
      if (run) parts.push(await run);
    }
    if (tickedFiles.length > 0) {
      const run = files();
      if (run) parts.push(await run);
    }
    return mergeResults(parts);
  };

  const offered = new Set(foldersBulkActions({ folders: tickedFolders.length, files: tickedFiles.length }));
  const none = select.count === 0;

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
      {offered.has('move') ? (
        <BulkBarAction icon={CornerUpRight} label="Move" disabled={busy} onClick={() => setDialog('move')} />
      ) : null}
      {offered.has('add_to_folder') ? (
        <BulkBarAction icon={FolderInput} label="Add to folder" disabled={busy} onClick={() => setDialog('add')} />
      ) : null}
      <BulkBarAction icon={Users} label="Move to a space" disabled={none || busy} onClick={() => setDialog('space')} />
      {offered.has('make_private') ? (
        <>
          <BulkBarAction
            icon={Lock}
            label="Make private"
            disabled={busy}
            onClick={() => privacy.mutate(() => bulkApi.folders(tickedFolders, { action: 'privacy', isPrivate: true }))}
          />
          <BulkBarAction
            icon={LockOpen}
            label="Make public"
            disabled={busy}
            onClick={() => privacy.mutate(() => bulkApi.folders(tickedFolders, { action: 'privacy', isPrivate: false }))}
          />
        </>
      ) : null}
      <BulkBarAction icon={Trash2} label="Delete" destructive disabled={none || busy} onClick={() => setDialog('delete')} />
    </BulkBar>
  ) : null;

  const dialogs = (
    <>
      <BulkConfirm
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
        title={`Delete ${countOf(select.count, NOUN)}?`}
        description="They can't be brought back."
        confirmLabel="Delete"
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(
            () =>
              both(
                () => bulkApi.folders(tickedFolders, { action: 'delete' }),
                () => bulkApi.files(tickedFiles, { action: 'delete' }),
              ),
            { onSettled: () => setDialog(null) },
          )
        }
      />
      {dialog === 'space' ? (
        <MoveToSpaceDialog
          item={{ type: 'folder', id: '', name: '', space: null }}
          open
          onOpenChange={(open) => (open ? undefined : setDialog(null))}
          pick={{
            count: select.count,
            onPick: (to) =>
              toSpace.mutate(() =>
                both(
                  () => bulkApi.folders(tickedFolders, { action: 'space', spaceUuid: to?.uuid ?? null }),
                  () => bulkApi.files(tickedFiles, { action: 'space', spaceUuid: to?.uuid ?? null }),
                ),
              ),
          }}
        />
      ) : null}
      <FolderChooser
        open={dialog === 'move'}
        onOpenChange={(open) => setDialog(open ? 'move' : null)}
        title={`Move ${countOf(tickedFolders.length, { one: 'folder', many: 'folders' })}`}
        description="Pick the folder to put them in, or the top level."
        topLevel
        excluded={new Set(tickedFolders)}
        onChoose={(to) => move.mutate(() => bulkApi.folders(tickedFolders, { action: 'move', parentId: to?.uuid ?? null }))}
      />
      <FolderChooser
        open={dialog === 'add'}
        onOpenChange={(open) => setDialog(open ? 'add' : null)}
        title={`Add ${countOf(tickedFiles.length, { one: 'file', many: 'files' })} to a folder`}
        description="Pick a folder for them."
        onChoose={(to) => {
          if (to) add.mutate(() => bulkApi.files(tickedFiles, { action: 'add_to_folder', folder: to.uuid }));
        }}
      />
    </>
  );

  return {
    selecting: select.active,
    isSelected: select.isSelected,
    toggle: select.toggle,
    startButton,
    bar,
    dialogs,
  };
}
