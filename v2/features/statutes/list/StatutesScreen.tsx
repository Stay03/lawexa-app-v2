'use client';

import { Suspense } from 'react';

import { useSearchPosition } from '@/v2/search-position';
import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { StatutesBrowser } from './StatutesBrowser';
import { StatutesListSkeleton } from './states';

/**
 * StatutesScreen — the `/statutes` client root. The exact job of `CasesScreen`,
 * ABOVE the `useSearchParams` boundary: wrapping the `useSearchParams` consumer
 * in a Suspense boundary (a Next requirement), with a fallback that mirrors
 * `loading.tsx` exactly so route boundary → this fallback → live content is one
 * continuous shape.
 *
 * It no longer publishes a header title. `/statutes` is a TOP-LEVEL screen and
 * the bar on one of those carries none — the title is in the page body
 * (`ScreenTitle`, from `top-level-route.ts`). See `CasesScreen` for the full
 * note; the removal is the same on all nine library screens.
 *
 * WHO CAN READ THIS: the route ships real metadata (a public, indexed
 * surface), but the DATA is auth-walled — measured July 31, 2026, every
 * statute endpoint 401s without a bearer token. `StatutesBrowser` gates its
 * queries on the session and shows the designed sign-in state; a signed-in
 * GUEST holds a real token and browses normally.
 */
export function StatutesScreen() {
  return (
    <Suspense fallback={<StatutesFallback />}>
      <StatutesBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the title, the country tab row and the search field as
 * reserved chrome shapes (furniture, not content placeholders), over the real
 * list skeleton. Identical to `app/v2/statutes/(library)/loading.tsx`, which
 * imports this component.
 *
 * The search shape is reserved WHERE IT WILL LAND, which is why the fallback
 * reads the position switch: reserving it at the wrong end would make the
 * hand-off a move across the screen rather than a resolve in place.
 *
 * The list skeleton pulses here exactly as it does inside the live screen
 * (standards §8i). A wait is a wait: the reader cannot tell an RSC payload from
 * a query, so two appearances for one wait would only print a seam into the
 * middle of the load.
 */
export function StatutesFallback() {
  const searchAtTop = useSearchPosition() === 'top';
  return (
    <>
      <span role="status" className="sr-only">
        Loading statutes
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a Suspense fallback is
          DELETED (not reconciled) when content arrives, so anything focusable
          in here would lose focus mid-interaction. */}
      <div aria-hidden inert className={LIST_COLUMN_DOCKED}>
        <ScreenTitle />
        {searchAtTop ? <SearchFieldShape className="mb-3" /> : null}
        <div className="mb-3 flex items-center">
          <div className="h-9 w-72 max-w-full rounded-full bg-secondary/60" />
        </div>
        <StatutesListSkeleton />
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
