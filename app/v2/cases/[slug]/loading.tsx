import { CaseFallback } from '@/v2/features/cases/detail/CaseScreen';

/**
 * Route-level loading boundary for `/cases/[slug]` — the same component the
 * page's own Suspense fallback renders, so the two hand-offs move nothing.
 * See `app/v2/cases/(library)/loading.tsx` for the full note, and
 * `app/v2/cases/loading.tsx` for why the parent boundary is this same shape.
 */
export default function CaseLoading() {
  return <CaseFallback />;
}
