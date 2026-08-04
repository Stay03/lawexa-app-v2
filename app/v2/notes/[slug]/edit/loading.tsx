import {
  NOTE_PAPER_COLUMN,
  NoteEditorSkeleton,
} from '@/v2/features/notes/editor/states';

/**
 * Route fallback for `/notes/[slug]/edit` — the same silhouette `/notes/create`
 * reserves, because it is the same editor. Sharing the shape is the point: a
 * reader moving from the note to its editor sees the document's geometry hold
 * still rather than two different guesses about it.
 *
 * Held STILL: this boundary waits on an RSC payload, not on the note (which is a
 * client query, and whose own pending state pulses — see `EditNoteScreen`).
 */
export default function EditNoteLoading() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading the note editor
      </span>
      <div aria-hidden inert className={NOTE_PAPER_COLUMN}>
        <div className="mb-6 h-9 w-24 rounded-full bg-secondary/60" />
        <NoteEditorSkeleton still />
      </div>
    </>
  );
}
