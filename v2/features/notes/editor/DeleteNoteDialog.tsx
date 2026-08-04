'use client';

import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { NoteRecord } from '../types';
import { useDeleteNote } from '../mutations';

/**
 * DeleteNoteDialog — the one destructive act the editor offers.
 *
 * THE DIALOG OWNS ITS OWN CLOSE. Radix's `AlertDialogAction` closes on click,
 * which would tear the dialog down BEFORE the request settles: the pending state
 * could never render, and a failure would leave the reader looking at a note
 * they believe they deleted. `preventDefault` keeps it open — the confirm button
 * shows its live pending state, success closes in `onSuccess` and navigates, and
 * a failure keeps the dialog open while the global error toast reports it.
 * `mutate`, never `mutateAsync` (standards §2).
 *
 * The copy is honest about the one thing people ask afterwards: images uploaded
 * into a note are files in their own right and are NOT removed with it.
 */
export function DeleteNoteDialog({
  open,
  onOpenChange,
  note,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Pick<NoteRecord, 'id' | 'slug' | 'title'>;
  /** Where to go once the note is gone — the editor's route is now dead. */
  onDeleted: () => void;
}) {
  const deleteNote = useDeleteNote();

  const confirm = (event: React.MouseEvent) => {
    event.preventDefault();
    deleteNote.mutate(
      { id: note.id, slug: note.slug },
      {
        onSuccess: () => {
          onOpenChange(false);
          onDeleted();
        },
      },
    );
  };

  const name = note.title?.trim() ? `“${note.title.trim()}”` : 'this untitled note';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The note and everything written in it will be removed from your
            notes. Images you uploaded into it stay in your files.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteNote.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={deleteNote.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteNote.isPending ? (
              <Loader2 aria-hidden className="motion-safe:animate-spin" />
            ) : null}
            Delete note
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
