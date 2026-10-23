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
 * The picker is held after it closes so its exit plays and its Undo toast can
 * still act, and each open bumps its key so a second note starts fresh (the
 * Folders page's loose files do the same). A delete needs no redirect here:
 * `useDeleteNote` refreshes every notes list, and the row leaves on its own.
 */
export function useNoteRowDialogs() {
  const [filing, setFiling] = useState<{ noteId: number; open: boolean; key: number } | null>(null);
  const [deleting, setDeleting] = useState<NoteRowModel | null>(null);

  const openAddToFolder = useCallback(
    (row: NoteRowModel) =>
      setFiling((previous) => ({ noteId: row.id, open: true, key: (previous?.key ?? 0) + 1 })),
    [],
  );
  const openDelete = useCallback((row: NoteRowModel) => setDeleting(row), []);

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
          note={{ id: deleting.id, slug: deleting.slug, title: deleting.hasTitle ? deleting.title : null }}
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </>
  );

  return { openAddToFolder, openDelete, dialogs };
}
