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
 */
export default function EditNoteLoading() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading the note editor
      </span>
      <div aria-hidden inert className={NOTE_PAPER_COLUMN}>
        <div className="mb-6 h-9 w-24 rounded-full bg-secondary/60" />
        <NoteEditorSkeleton />
      </div>
    </>
  );
}
