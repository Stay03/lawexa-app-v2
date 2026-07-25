import { CasesFallback } from '@/v2/features/cases/list/CasesScreen';

/**
 * Route-level loading boundary for `/cases`.
 *
 * It renders the SAME component as the page's own Suspense fallback, which is
 * the whole point: route boundary → Suspense fallback → live list is one
 * continuous shape, so nothing moves at either hand-off. A hand-drawn fallback
 * diverges from the real surface within two design rounds — the lesson
 * `home-frame.ts` exists to enforce, applied here to a list.
 *
 * Everything static inside it (the search field, the view tabs) is a STILL
 * RESERVED SHAPE, never a pulsing skeleton: those controls wait on no request
 * (standards §8i). Only the rows pulse, and even they hold still here — the
 * route fallback covers an RSC payload, and the query behind those rows is
 * usually already warm.
 */
export default function CasesLoading() {
  return <CasesFallback />;
}
