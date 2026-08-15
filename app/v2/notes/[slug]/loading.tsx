import { NoteFallback } from '@/v2/features/notes/reader/NoteScreen';

/**
 * Route-level loading boundary for a single note — the same component the
 * reader paints while its own content is on the way, so route boundary →
 * Suspense fallback → the note is one continuous shape.
 *
 * ── WHY IT DID NOT EXIST, AND WHAT ADDING IT BUYS ──────────────────────────
 * `cases/[slug]` and `statutes/[slug]` both had one; `notes/[slug]` did not,
 * and leaned on `notes/loading.tsx` instead. That forced the SEGMENT boundary
 * to wear the reader's shape, which in turn put a document silhouette ahead of
 * `/notes/create` and `/notes/{slug}/edit` — a compromise its docblock recorded
 * honestly and accepted, because the alternative on offer was a blank beat
 * ahead of every note.
 *
 * The choice was never actually binary. With this file in place the note keeps
 * its document skeleton on every list→note click (this is the boundary closest
 * to the changed segment, so it is the one that paints), and the segment
 * boundary above is free to be neutral for the children that are not notes.
 * Nobody loses a skeleton and nobody sees the wrong one.
 */
export default function NoteLoading() {
  return <NoteFallback />;
}
