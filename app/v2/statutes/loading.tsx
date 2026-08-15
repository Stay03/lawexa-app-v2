import { DestinationFallback } from '@/v2/runtime/destination-fallback';
import { StatuteFallback } from '@/v2/features/statutes/reader/StatuteScreen';
import { StatutesFallback } from '@/v2/features/statutes/list/StatutesScreen';

/**
 * The `statutes` SEGMENT boundary — it paints the shape of the DESTINATION.
 * The `(library)` route group gives the list its own inner boundary without
 * taking the list out of this one, so this file runs for both the list and the
 * readers, and either shape chosen statically is wrong for the other half.
 * `destination-fallback.tsx` carries the full account.
 */
export default function StatutesSegmentLoading() {
  return (
    <DestinationFallback
      indexPaths={['/statutes', '/v2/statutes']}
      index={<StatutesFallback />}
      document={<StatuteFallback />}
    />
  );
}
