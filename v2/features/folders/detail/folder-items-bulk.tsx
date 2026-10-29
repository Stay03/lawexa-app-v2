'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FolderInput, FolderMinus } from 'lucide-react';

import { bulkApi } from '@/v2/features/bulk/api';
import { BulkBar, BulkBarAction } from '@/v2/features/bulk/BulkBar';
import { BulkConfirm } from '@/v2/features/bulk/BulkConfirm';
import { FolderChooser } from '@/v2/features/bulk/FolderChooser';
import { countOf, type BulkItemId } from '@/v2/features/bulk/model';
import { useBulkAction, useBulkSelection } from '@/v2/features/bulk/use-bulk-selection';
import { spacesQueries } from '@/v2/features/spaces/queries';
import type { FolderItemRowModel } from '../item-row-model';
import { foldersQueries } from '../queries';

/**
 * Bulk select inside a folder (Arthur, 20 October 2026; part 1): the
 * folder's cases, statutes, notes and files, ticked together, then taken out
 * of this folder (it asks first, with the count) or added to another one.
 * Nothing is deleted: taking an item out leaves it where it was, the same
 * verb as one row's menu ("Remove from this folder").
 *
 * One request per action (`POST /bulk/folder-items`, 50 a time). Subfolders
 * are not ticked here: they are folders, with the Folders page's actions.
 */

/** A ticked item: its type and its content's own id, as the single removal addresses it. */
export const itemKey = (row: Pick<FolderItemRowModel, 'type' | 'contentId'>) => `${row.type}:${row.contentId}`;

const NOUN = { one: 'item', many: 'items' };

export function useFolderItemsBulk({ folderUuid, items }: { folderUuid: string; items: readonly FolderItemRowModel[] }) {
  const keys = useMemo(() => items.map(itemKey), [items]);
  const select = useBulkSelection<string>(keys);
  const [dialog, setDialog] = useState<'remove' | 'add' | null>(null);
  const queryClient = useQueryClient();

  const byKey = useMemo(() => new Map(items.map((row) => [itemKey(row), row])), [items]);
  const ticked = [...select.selection].flatMap((key) => {
    const row = byKey.get(key);
    return row ? [{ type: row.type, id: row.contentId }] : [];
  });

  const refresh = () => {
    for (const key of [foldersQueries.lists(), foldersQueries.details(), foldersQueries.itemLists(), foldersQueries.looseFilesKey(), spacesQueries.all]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
  // A failed item comes back as its own `{type, id}`.
  const keepFailed = (ids: ReadonlyArray<BulkItemId>) =>
    select.keepOnly(ids.flatMap((id) => (typeof id === 'object' && id !== null ? [`${id.type}:${id.id}`] : [])));

  const remove = useBulkAction({ verb: { past: 'Removed', pastLower: 'removed' }, noun: NOUN, onSettled: refresh, keepFailed });
  const add = useBulkAction({ verb: { past: 'Added', pastLower: 'added' }, noun: NOUN, onSettled: refresh, keepFailed });
  const busy = remove.isPending || add.isPending;
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
      selectAllInHead
    >
      <BulkBarAction icon={FolderInput} label="Add to another folder" disabled={none || busy} onClick={() => setDialog('add')} />
      <BulkBarAction icon={FolderMinus} label="Remove from this folder" disabled={none || busy} onClick={() => setDialog('remove')} />
    </BulkBar>
  ) : null;

  const dialogs = (
    <>
      <BulkConfirm
        open={dialog === 'remove'}
        onOpenChange={(open) => setDialog(open ? 'remove' : null)}
        title={`Remove ${countOf(select.count, NOUN)} from this folder?`}
        description="They stay where they were. Only this folder lets go of them."
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(() => bulkApi.folderItems(folderUuid, ticked, 'remove'), { onSettled: () => setDialog(null) })
        }
      />
      <FolderChooser
        open={dialog === 'add'}
        onOpenChange={(open) => setDialog(open ? 'add' : null)}
        title={`Add ${countOf(select.count, NOUN)} to another folder`}
        description="They stay in this folder too."
        excluded={new Set([folderUuid])}
        onChoose={(to) => {
          if (to) add.mutate(() => bulkApi.folderItems(to.uuid, ticked, 'add'));
        }}
      />
    </>
  );

  return {
    selecting: select.active,
    isSelected: select.isSelected,
    toggle: select.toggle,
    startWith: select.startWith,
    headSelectAll: {
      selecting: select.active,
      state: select.allState,
      onToggle: select.active ? select.toggleAll : select.startAll,
      label: `Select all ${countOf(keys.length, NOUN)}`,
    },
    startButton,
    bar,
    dialogs,
  };
}
