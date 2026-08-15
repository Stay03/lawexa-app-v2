import { SegmentFallback } from '@/v2/shell/segment-fallback';

/**
 * The `folders` SEGMENT boundary — neutral, for the reason written out in full
 * in `app/v2/cases/loading.tsx`.
 *
 * It carried the folder DETAIL's shape while also wrapping the folder list, so
 * the list painted a detail silhouette before its own. `folders/[uuid]` now has
 * its own boundary — it had none, which is what forced the compromise — so
 * nothing loses a skeleton by this being empty.
 */
export default function FoldersSegmentLoading() {
  return <SegmentFallback label="Loading folders section" />;
}
