'use client';

import { useSearchPosition } from '@/v2/search-position';
import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { NotesListSkeleton } from './states';

/**
 * The notes library's loading shape — the title, the tab strip and the search
 * field as reserved shapes for the real controls (chrome, not content: the live
 * screen puts the real field and the real tabs on those pixels), over the list
 * skeleton, which pulses here exactly as it does on the live screen (standards
 * §8i). A wait is a wait, and the reader cannot tell an RSC payload from a
 * query. `NotesScreen` renders it as its Suspense fallback and both
 * `app/v2/notes` route boundaries render it too, so the two can never drift.
 *
 * ITS OWN FILE ON PURPOSE, for the reason `CasesFallback` gives: a loading
 * boundary ships every module its imports reach, and exported from
 * `NotesScreen.tsx` this pulled the live browser into the loading screen.
 * Nothing in this file may import a screen.
 *
 * "New note" is NOT reserved here, and the reason is the one it always was:
 * whether it exists depends on the viewer's role, so reserving it would hold a
 * permanent gap for every guest. It arrives at the END of the tab row, opposite
 * the strip, so nothing already on the pixels moves when it does.
 */
export function NotesFallback() {
  const searchAtTop = useSearchPosition() === 'top';
  return (
    <>
      <span role="status" className="sr-only">
        Loading notes
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a Suspense fallback is
          DELETED, not reconciled, when content arrives — so anything focusable
          in here would lose focus and caret mid-interaction. */}
      <div aria-hidden inert className={LIST_COLUMN_DOCKED}>
        <ScreenTitle />
        {searchAtTop ? <SearchFieldShape className="mb-3" /> : null}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="h-9 w-44 max-w-full rounded-full bg-secondary/60" />
        </div>
        <NotesListSkeleton />
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
