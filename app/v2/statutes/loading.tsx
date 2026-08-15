import { StatuteFallback } from '@/v2/features/statutes/reader/StatuteScreen';

/**
 * The `statutes` SEGMENT boundary — the fallback for whatever child is being
 * navigated INTO under `/statutes`, and that child is always a STATUTE
 * (the list has its own boundary inside the `(library)` route group).
 *
 * Same reasoning as `app/v2/cases/loading.tsx`, which carries the full note:
 * under the v2 rewrite proxy the client cannot prefetch parameterised routes,
 * so this boundary shows on every list→statute click for a full server round
 * trip — it must therefore be the READER's shape, so the reader sees document
 * skeleton → document skeleton → the Act, and the hand-offs move nothing.
 * Do not "simplify" the two loading files back into one.
 */
export default function StatutesSegmentLoading() {
  return <StatuteFallback />;
}
