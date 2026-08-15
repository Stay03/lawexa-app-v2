import { DestinationFallback } from '@/v2/runtime/destination-fallback';
import { FolderDetailFallback } from '@/v2/features/folders/detail/FolderScreen';
import { FoldersFallback } from '@/v2/features/folders/list/FoldersScreen';

/**
 * The `folders` SEGMENT boundary — it paints the shape of the DESTINATION.
 * The `(library)` route group gives the list its own inner boundary without
 * taking the list out of this one. `destination-fallback.tsx` carries the full
 * account.
 */
export default function FoldersSegmentLoading() {
  return (
    <DestinationFallback
      indexPaths={['/folders', '/v2/folders']}
      index={<FoldersFallback />}
      document={<FolderDetailFallback />}
    />
  );
}
