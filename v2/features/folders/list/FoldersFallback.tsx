'use client';

import { useSearchPosition } from '@/v2/search-position';
import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { FoldersListSkeleton } from './states';

/**
 * The folders library's loading shape — the title with its two actions and the
 * search field as reserved shapes for the real controls (chrome, not content:
 * the live screen puts the real controls on those pixels), over
 * the list skeleton, which pulses here exactly as it does on the live screen
 * (standards §8i). A wait is a wait, and the reader cannot tell an RSC payload
 * from a query. `FoldersScreen` renders it as its Suspense fallback and both
 * `app/v2/folders` route boundaries render it too, so the two can never drift.
 *
 * ITS OWN FILE ON PURPOSE, for the reason `CasesFallback` gives: a loading
 * boundary ships every module its imports reach, and exported from
 * `FoldersScreen.tsx` this pulled the live browser into the loading screen.
 * Nothing in this file may import a screen.
 *
 * The "New folder" pill IS reserved here, unlike the notes library's "New
 * note". Both are inline controls above the list; the difference is
 * who gets them. This one exists for every signed-in reader, so reserving it
 * prevents a jump, while "New note" depends on the viewer's role and reserving
 * it would hold a permanent gap for every guest.
 */
export function FoldersFallback() {
  const searchAtTop = useSearchPosition() === 'top';
  return (
    <>
      <span role="status" className="sr-only">
        Loading your folders
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a Suspense fallback is
          DELETED, not reconciled, when content arrives — so anything focusable
          in here would lose focus and caret mid-interaction. */}
      <div aria-hidden inert className={LIST_COLUMN_DOCKED}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <ScreenTitle className="mb-0 min-w-0 truncate" />
          <div className="flex shrink-0 items-center gap-2">
            {/* "Upload a file" (build 6), then "New folder", on the heading's line. */}
            <div className="h-11 w-24 rounded-full border border-border sm:w-36" />
            <div className="h-11 w-11 rounded-full bg-primary/60 sm:w-32" />
          </div>
        </div>
        {searchAtTop ? <SearchFieldShape className="mb-3" /> : null}
        <FoldersListSkeleton />
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
