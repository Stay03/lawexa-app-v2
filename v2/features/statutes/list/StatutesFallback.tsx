'use client';

import { useSearchPosition } from '@/v2/search-position';
import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { StatutesListSkeleton } from './states';

/**
 * The statutes library's loading shape — the title, the country tab row and the
 * search field as reserved chrome shapes (furniture, not content placeholders),
 * over the real list skeleton. `StatutesScreen` renders it as its Suspense
 * fallback and both `app/v2/statutes` route boundaries render it too.
 *
 * ITS OWN FILE ON PURPOSE, for the reason `CasesFallback` gives: a loading
 * boundary ships every module its imports reach, and exported from
 * `StatutesScreen.tsx` this pulled the live browser into the loading screen.
 * Nothing in this file may import a screen.
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
