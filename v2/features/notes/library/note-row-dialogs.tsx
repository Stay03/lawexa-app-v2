'use client';

import { useCallback, useState } from 'react';

import { FolderPicker } from '@/v2/features/folders/picker/FolderPicker';
import { DeleteNoteDialog } from '../editor/DeleteNoteDialog';
import type { NoteRowModel } from '../note-row-model';

/**
 * The two dialogs a note row's menu opens (`NoteRowMenu`): the shared folder
 * picker and the editor's delete dialog, held by the LIST so one of each
 * serves every row.
 *
 * Both are held after they close so their exit plays (the house motion rule:
 * nothing disappears abruptly), and the picker's Undo toast can still act.
 * Each open bumps its key so a second note starts fresh (the Folders page's
 * loose files do the same). A delete needs no redirect here:
 * `useDeleteNote` refreshes every notes list, and the row leaves on its own.
 */
export function useNoteRowDialogs() {
  const [filing, setFiling] = useState<{ noteId: number; open: boolean; key: number } | null>(null);
  const [deleting, setDeleting] = useState<{ row: NoteRowModel; open: boolean; key: number } | null>(null);

  const openAddToFolder = useCallback(
    (row: NoteRowModel) =>
      setFiling((previous) => ({ noteId: row.id, open: true, key: (previous?.key ?? 0) + 1 })),
    [],
  );
  const openDelete = useCallback(
    (row: NoteRowModel) => setDeleting((previous) => ({ row, open: true, key: (previous?.key ?? 0) + 1 })),
    [],
  );
  const closeDelete = useCallback(
    () => setDeleting((previous) => (previous ? { ...previous, open: false } : previous)),
    [],
  );

  const dialogs = (
    <>
      {filing ? (
        <FolderPicker
          key={filing.key}
          target={{ type: 'note', contentId: filing.noteId }}
          open={filing.open}
          onOpenChange={(open) => setFiling((previous) => (previous ? { ...previous, open } : previous))}
        />
      ) : null}
      {deleting ? (
        <DeleteNoteDialog
          key={deleting.key}
          note={{ id: deleting.row.id, slug: deleting.row.slug, title: deleting.row.hasTitle ? deleting.row.title : null }}
          open={deleting.open}
          onOpenChange={(open) => {
            if (!open) closeDelete();
          }}
          onDeleted={closeDelete}
        />
      ) : null}
    </>
  );

  return { openAddToFolder, openDelete, dialogs };
}
