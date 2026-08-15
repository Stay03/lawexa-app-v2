import { SegmentFallback } from '@/v2/shell/segment-fallback';

/**
 * The `statutes` SEGMENT boundary — neutral, for the reason written out in full
 * in `app/v2/cases/loading.tsx`.
 *
 * It carried the READER's shape and, like cases, still wrapped its own list:
 * `(library)` gave the list an inner fallback without taking it out of this
 * boundary, so entering the segment cold and landing on the list painted a
 * document silhouette first.
 *
 * `statutes/[slug]/loading.tsx` already exists and is closer to the changed
 * segment on a list→statute click, so the reader keeps its document skeleton.
 */
export default function StatutesSegmentLoading() {
  return <SegmentFallback label="Loading statutes section" />;
}
