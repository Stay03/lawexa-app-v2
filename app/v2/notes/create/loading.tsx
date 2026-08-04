import {
  NOTE_PAPER_COLUMN,
  NoteEditorSkeleton,
} from '@/v2/features/notes/editor/states';

/**
 * Route fallback for `/notes/create` — the editor's resting silhouette: the back
 * link, a title line, and the first lines of a body, in the paper's own measure.
 *
 * Held STILL (standards §8i). Nothing is in flight behind a blank editor — this
 * boundary is waiting on an RSC payload, not on data — so a pulse would promise
 * a request that does not exist.
 */
export default function CreateNoteLoading() {
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
