import {
  NOTE_PAPER_COLUMN,
  NoteEditorSkeleton,
} from '@/v2/features/notes/editor/states';

/**
 * Route fallback for `/notes/[slug]/edit` — the same silhouette `/notes/create`
 * reserves, because it is the same editor. Sharing the shape is the point: a
 * reader moving from the note to its editor sees one geometry rather than two
 * different guesses about it.
 *
 * It PULSES, exactly as `EditNoteScreen`'s own pending state does (standards
 * §8i). The reader cannot tell this boundary's wait from the note query's wait,
 * so giving the two different appearances would only print a seam into the
 * middle of the load.
 *
 * THE RESERVED PILL IS ON THE RIGHT (phase 7): the row above the paper used to
 * open with a "← Notes" chip and now holds only the save state and the note's
 * own verbs, because the way back moved into the shell's bar.
 */
export default function EditNoteLoading() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading the note editor
      </span>
      <div aria-hidden inert className={NOTE_PAPER_COLUMN}>
        <div className="mb-6 flex min-h-9 justify-end">
          <div className="h-9 w-24 rounded-full bg-secondary/60" />
        </div>
        <NoteEditorSkeleton />
      </div>
    </>
  );
}
