import {
  NOTE_PAPER_COLUMN,
  NoteEditorSkeleton,
} from '@/v2/features/notes/editor/states';

/**
 * Route fallback for `/notes/create` — the editor's resting silhouette: the save
 * state, a title line, and the first lines of a body, in the paper's own measure.
 * The back link that used to open this row went to the shell's bar (phase 7),
 * so what is reserved here sits on the RIGHT.
 *
 * It PULSES, the same as every other wait in v2 (standards §8i). A wait is a
 * wait: the reader cannot tell this boundary's RSC payload from a query, so a
 * shape that sat frozen here and then started shimmering the moment the screen
 * took over would read as the load starting again.
 */
export default function CreateNoteLoading() {
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
