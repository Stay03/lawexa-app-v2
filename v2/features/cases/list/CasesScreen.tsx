'use client';

import { Suspense } from 'react';

import { CasesBrowser } from './CasesBrowser';
import { CasesFallback } from './CasesFallback';

/**
 * CasesScreen — the `/cases` client root.
 *
 * ONE job now, ABOVE the `useSearchParams` boundary so it does not depend on
 * the URL: wrapping the `useSearchParams` consumer in a Suspense boundary (a
 * Next requirement), with a fallback that mirrors `loading.tsx` exactly so
 * route boundary → this fallback → live content is one continuous shape.
 *
 * THE SECOND JOB IS GONE, DELIBERATELY. This screen used to publish "Cases" to
 * the header's centre slot on mount. `/cases` is a TOP-LEVEL screen, and on one
 * of those the bar carries no title at all — the title lives in the page body
 * (`ScreenTitle`, fed by `top-level-route.ts`). Publishing one as well would put
 * the reader's screen name on the pixels twice; the effect and its cleanup were
 * removed rather than left dormant.
 *
 * WHO CAN READ THIS. The route is public in the sense that matters for SEO — it
 * ships real metadata and it is in the sitemap — but the DATA is not: measured
 * July 25, 2026, `GET /api/cases` answers **401** without a bearer token. v1
 * hides that by minting a guest token for every visitor (`useGuestAuth`); v2 has
 * no equivalent yet. So `CasesBrowser` gates its queries on the session and
 * shows a designed sign-in state rather than a network error. A signed-in GUEST
 * account reads the library normally — a guest holds a real token, so
 * `signedIn` is true for them; the only account-gated affordance is the content
 * request.
 */
export function CasesScreen() {
  return (
    <Suspense fallback={<CasesFallback />}>
      <CasesBrowser />
    </Suspense>
  );
}
