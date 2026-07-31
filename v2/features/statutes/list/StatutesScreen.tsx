'use client';

import { Suspense, useEffect } from 'react';

import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { StatutesBrowser } from './StatutesBrowser';
import { StatutesListSkeleton } from './states';

/**
 * StatutesScreen — the `/statutes` client root. The exact two jobs of
 * `CasesScreen`, both ABOVE the `useSearchParams` boundary:
 *
 *  1. PUBLISHES the header centre-slot title ("Statutes") on mount and clears
 *     it on unmount — an external-store write, which is what makes it legal
 *     inside an effect under the React Compiler lint.
 *  2. Wraps the `useSearchParams` consumer in a Suspense boundary (a Next
 *     requirement), with a fallback that mirrors `loading.tsx` exactly so
 *     route boundary → this fallback → live content is one continuous shape.
 *
 * WHO CAN READ THIS: the route ships real metadata (a public, indexed
 * surface), but the DATA is auth-walled — measured July 31, 2026, every
 * statute endpoint 401s without a bearer token. `StatutesBrowser` gates its
 * queries on the session and shows the designed sign-in state; a signed-in
 * GUEST holds a real token and browses normally.
 */
export function StatutesScreen() {
  useEffect(() => {
    setHeaderContext({ title: 'Statutes', confidential: false });
    return () => clearHeaderContext();
  }, []);

  return (
    <Suspense fallback={<StatutesFallback />}>
      <StatutesBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the search field and the tab row as STILL RESERVED
 * SHAPES (they wait on no request), over the real list skeleton. Identical to
 * `app/v2/statutes/(library)/loading.tsx`, which imports this component.
 */
export function StatutesFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading statutes
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a Suspense fallback is
          DELETED (not reconciled) when content arrives, so anything focusable
          in here would lose focus mid-interaction. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <SearchFieldShape className="mb-3" />
        <div className="mb-3 flex items-center">
          <div className="h-9 w-72 max-w-full rounded-full bg-secondary/60" />
        </div>
        <StatutesListSkeleton still />
      </div>
    </>
  );
}
