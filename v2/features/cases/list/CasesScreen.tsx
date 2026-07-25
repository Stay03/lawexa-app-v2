'use client';

import { Suspense, useEffect } from 'react';

import { SearchFieldShape } from '@/v2/shell/SearchField';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { CasesBrowser } from './CasesBrowser';
import { CasesListSkeleton } from './states';

/**
 * CasesScreen — the `/cases` client root.
 *
 * Two jobs, both ABOVE the `useSearchParams` boundary so neither depends on the
 * URL:
 *
 *  1. PUBLISHES the header centre-slot title. On a non-home route the header
 *     shows the route's published context; this page publishes a static
 *     "Cases" on mount and clears it on unmount. That is an external-store
 *     write, not React state, which is why it is legal inside an effect under
 *     the React Compiler lint — the same seam `ConversationsScreen` uses.
 *  2. Wraps the `useSearchParams` consumer in a Suspense boundary (a Next
 *     requirement), with a fallback that mirrors `loading.tsx` exactly so
 *     route boundary → this fallback → live content is one continuous shape.
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
  useEffect(() => {
    setHeaderContext({ title: 'Cases', confidential: false });
    return () => clearHeaderContext();
  }, []);

  return (
    <Suspense fallback={<CasesFallback />}>
      <CasesBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the search field and view tabs as STILL RESERVED SHAPES
 * (they wait on no request), over the real list skeleton. Identical to
 * `app/v2/cases/loading.tsx`, which imports the same pieces.
 */
export function CasesFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading cases
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a Suspense fallback is
          DELETED (not reconciled) when content arrives, so anything focusable
          in here would lose focus and caret mid-interaction. */}
      <div aria-hidden inert className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5 sm:pt-6">
        <SearchFieldShape className="mb-3" />
        <div className="mb-3 flex items-center">
          <div className="h-9 w-40 rounded-full bg-secondary/60" />
        </div>
        <CasesListSkeleton still />
      </div>
    </>
  );
}
