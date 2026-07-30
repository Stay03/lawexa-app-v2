import { CaseFallback } from '@/v2/features/cases/detail/CaseScreen';

/**
 * The `cases` SEGMENT boundary — the fallback for whatever child is being
 * navigated INTO under `/cases`, and that child is always a CASE.
 *
 * WHY THIS RENDERS THE DOCUMENT SKELETON AND NOT THE LIST'S (owner, July 31 —
 * "I first see the case list skeleton, then the case skeleton"): a segment's
 * `loading.tsx` wraps its CHILD SLOT. When the reader clicks a case row, the
 * slot swaps from the list to `[slug]`, and until the target's own shell
 * arrives this boundary is everything the router can paint. Under the v2
 * rewrite proxy the client cannot prefetch parameterised routes (its segment
 * cache builds `/undefined` URLs — the same Next-16 defect behind the chat's
 * quiet-write fix in `url-params.ts`), so this fallback shows on EVERY
 * list→case click for a full server round trip. It must therefore be the
 * DOCUMENT's shape: the reader then sees document skeleton → document
 * skeleton (the `[slug]` boundary renders the identical component) → the
 * case, and the hand-offs move nothing.
 *
 * The LIST'S own fallback lives beside the list page in `(library)/` — a
 * route group, so the list no longer shares this boundary and each surface
 * loads under its own shape. Do not "simplify" the two files back into one.
 */
export default function CasesSegmentLoading() {
  return <CaseFallback />;
}
