import { NoteFallback } from '@/v2/features/notes/reader/NoteScreen';

/**
 * The `notes` SEGMENT boundary — the fallback for whatever child is being
 * navigated INTO under `/notes`, and that child is a NOTE (the library has its
 * own boundary inside the `(library)` route group).
 *
 * Same reasoning as `app/v2/cases/loading.tsx` and
 * `app/v2/statutes/loading.tsx`, which carry the full note: under the v2
 * rewrite proxy the client cannot prefetch parameterised routes, so this
 * boundary shows on EVERY list→note click for a full server round trip. It
 * must therefore be the READER's shape, so the reader sees document skeleton →
 * the note, and the hand-off moves nothing.
 *
 * THE AUTHORING ROUTES ARE THE ONE COMPROMISE, and it is the shallow one: this
 * also covers the first beat of `/notes/create` and `/notes/{slug}/edit` until
 * each of those segments' own `loading.tsx` arrives. A document silhouette
 * ahead of an editor is a near miss — same column, same title-then-body
 * shape — whereas making this boundary NEUTRAL to be safe would put a blank
 * beat ahead of every single note, which is the common path by a wide margin.
 */
export default function NotesSegmentLoading() {
  return <NoteFallback />;
}
