'use client';

import { useSearchPosition } from '@/v2/search-position';
import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { CasesListSkeleton } from './states';

/**
 * The cases library's loading shape — the title, the view tabs and the search
 * field as reserved chrome shapes (furniture, not content placeholders), over
 * the real list skeleton. `CasesScreen` renders it as its Suspense fallback and
 * both `app/v2/cases` route boundaries render it too, so route boundary →
 * Suspense fallback → live list is one continuous shape.
 *
 * ITS OWN FILE ON PURPOSE. A loading boundary ships every module its imports
 * reach, before the page it stands in for has arrived. Exported from
 * `CasesScreen.tsx`, this pulled the live browser (`CasesBrowser`, its queries
 * and rows) into the loading screen; here it reaches only the shell's shapes and
 * the list skeleton. Keep it that way: nothing in this file may import a screen.
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
