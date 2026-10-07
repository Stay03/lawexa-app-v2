import { CaseLoading as CaseLoadingBoundary } from '@/v2/features/cases/detail/CaseLoading';

/**
 * Route-level loading boundary for `/cases/[slug]`. It draws the case at once
 * when the reader's memory cache already holds it (a search row read on
 * intent, or a case read earlier in the visit), and the skeleton otherwise —
 * the same skeleton the page's own Suspense fallback renders, so the hand-off
 * moves nothing. See `v2/features/cases/detail/CaseLoading.tsx`, and
 * `app/v2/cases/loading.tsx` for why the parent boundary is the same shape.
 */
export default function CaseLoading() {
  return <CaseLoadingBoundary />;
}
