import { CaseFallback } from '@/v2/features/cases/detail/CaseScreen';

/**
 * Route-level loading boundary for `/cases/[slug]` — the same component the
 * page's own Suspense fallback renders, so the two hand-offs move nothing.
 * See `app/v2/cases/loading.tsx` for the full note.
 */
export default function CaseLoading() {
  return <CaseFallback />;
}
