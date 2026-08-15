import { SegmentFallback } from '@/v2/shell/segment-fallback';

/**
 * The `notes` SEGMENT boundary.
 *
 * ── IT USED TO BE THE READER, AND IT NO LONGER HAS TO BE ───────────────────
 * A segment's `loading.tsx` wraps its CHILD SLOT. This one's children are a
 * note (`[slug]`), an editor (`[slug]/edit`) and a create form (`create`) —
 * more than one shape. It nevertheless rendered `NoteFallback`, and its
 * docblock recorded the trade honestly: a document silhouette ahead of an
 * editor is a near miss, and the alternative on offer was a blank beat ahead of
 * every note, which is the common path by a wide margin.
 *
 * That trade is gone rather than re-argued. `notes/[slug]` now carries its own
 * boundary — the thing `cases/[slug]` and `statutes/[slug]` always had and this
 * section never did — so a note keeps its document skeleton on every list→note
 * click, from the boundary closest to the changed segment. With the common path
 * covered, this file can follow rule 2 in `app/v2/loading.tsx` literally: a
 * segment whose children differ must be NEUTRAL, never one sibling's shape.
 *
 * Neutral means EMPTY (rule 3). It shows only when the `notes` segment itself
 * is entered cold — a jump from another section — and there the persistent
 * shell already frames the wait while the destination's own boundary takes over
 * the moment its shell arrives.
 */
export default function NotesSegmentLoading() {
  return <SegmentFallback label="Loading notes section" />;
}
