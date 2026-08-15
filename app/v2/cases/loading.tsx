import { DestinationFallback } from '@/v2/runtime/destination-fallback';
import { CaseFallback } from '@/v2/features/cases/detail/CaseScreen';
import { CasesFallback } from '@/v2/features/cases/list/CasesScreen';

/**
 * The `cases` SEGMENT boundary — the fallback for whatever child is being
 * navigated INTO under `/cases`, which is either the library list or a case.
 *
 * IT PAINTS THE SHAPE OF THE DESTINATION, not a compromise between the two.
 * The `(library)` route group gives the list its own inner boundary but does
 * NOT take the list out of this one, so this file is what actually runs for
 * both — and picking either shape statically breaks the other. Both of those
 * were shipped and measured before this landed; `destination-fallback.tsx`
 * carries the full account.
 */
export default function CasesSegmentLoading() {
  return (
    <DestinationFallback
      indexPaths={['/cases', '/v2/cases']}
      index={<CasesFallback />}
      document={<CaseFallback />}
    />
  );
}
