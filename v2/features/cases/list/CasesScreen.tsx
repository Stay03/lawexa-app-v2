'use client';

import { Suspense } from 'react';

import { useSearchPosition } from '@/v2/search-position';
import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { CasesBrowser } from './CasesBrowser';
import { CasesListSkeleton } from './states';

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

/**
 * Suspense fallback — the title, the view tabs and the search field as reserved
 * chrome shapes (furniture, not content placeholders), over the real list
 * skeleton. Identical to `app/v2/cases/loading.tsx`, which imports the same
 * pieces.
 *
 * The title is drawn by the SAME component the live screen uses, so the words
 * and the scale cannot drift; it is chrome the address already knows, so it
 * needs no reservation and no shimmer.
 *
 * The search field is reserved WHERE IT WILL LAND — in the floating dock by
 * default, in the flow if the developer switch says so — which is why this
 * fallback reads the position store too. Reserving it in the wrong place would
 * be worse than not reserving it: the hand-off would move it across the screen.
 *
 * The list skeleton pulses here exactly as it does inside the live screen
 * (standards §8i). A wait is a wait: the reader cannot tell an RSC payload from
 * a query, so giving the two waits different appearances only prints a seam
 * into the middle of the load.
 */
export function CasesFallback() {
  const searchAtTop = useSearchPosition() === 'top';
  return (
    <>
      <span role="status" className="sr-only">
        Loading cases
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a Suspense fallback is
          DELETED (not reconciled) when content arrives, so anything focusable
          in here would lose focus and caret mid-interaction. */}
      <div aria-hidden inert className={LIST_COLUMN_DOCKED}>
        <ScreenTitle />
        {searchAtTop ? <SearchFieldShape className="mb-3" /> : null}
        <div className="mb-3 flex items-center">
          <div className="h-9 w-40 rounded-full bg-secondary/60" />
        </div>
        <CasesListSkeleton />
        {searchAtTop ? null : (
          <ScreenDock>
            <ScreenDockSearch>
              <SearchFieldShape />
            </ScreenDockSearch>
          </ScreenDock>
        )}
      </div>
    </>
  );
}
