import { SegmentFallback } from '@/v2/shell/segment-fallback';

/**
 * The `cases` SEGMENT boundary.
 *
 * ── IT USED TO BE THE DOCUMENT, AND THAT WAS ONLY HALF RIGHT ───────────────
 * A segment's `loading.tsx` wraps its CHILD SLOT. In July it was made the
 * DOCUMENT's shape to fix the owner's report — "I first see the case list
 * skeleton, then the case skeleton" — and for a list→case click that was
 * correct and still is: the reader saw document → document → the case.
 *
 * THE ROUTE GROUP DID NOT REMOVE THE LIST FROM THIS BOUNDARY. `(library)` gave
 * the list its own inner fallback; it did not take `(library)/page.tsx` out of
 * `cases/`. So entering the segment cold and landing on the LIST still ran this
 * boundary first, in the document's shape, and the same fault the July pass was
 * about survived in the opposite direction.
 *
 * MEASURED 15 August, /notes → /cases, recording each fallback's `role="status"`
 * line as it appeared:
 *
 *     332ms  "Loading page"    the blank root beat
 *     643ms  "Loading case"    THIS FILE — a document silhouette before a list
 *     956ms  "Loading cases"   the list's own boundary
 *    2486ms  the list
 *
 * Three shapes to reach a list. It was found by recording the announcements
 * across a section switch, after being read as fixed from the docblock that
 * used to sit here — which described the half it did fix, accurately.
 *
 * ── SO IT IS NEUTRAL NOW, AND NOTHING LOSES ITS SKELETON ───────────────────
 * The children differ — `[slug]` and `[slug]/report` are documents, and the
 * list sits here too — so rule 2 in `app/v2/loading.tsx` applies: never one
 * sibling's shape. Both document routes already carry their own boundary, and
 * they are closer to the changed segment on a list→case click, so a case still
 * gets its document skeleton immediately. The list now gets only the list's.
 */
export default function CasesSegmentLoading() {
  return <SegmentFallback label="Loading cases section" />;
}
