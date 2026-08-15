'use client';

import { Suspense } from 'react';

import { useSearchPosition } from '@/v2/search-position';
import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { FoldersBrowser } from './FoldersBrowser';
import { FoldersListSkeleton } from './states';

/**
 * FoldersScreen — the `/folders` client root. The job `NotesScreen` and
 * `CasesScreen` do, ABOVE the `useSearchParams` boundary so it does not depend
 * on the URL: wrapping the `useSearchParams` consumer (`FoldersBrowser` reads
 * the search) in the Suspense boundary Next requires, with a fallback that
 * mirrors `loading.tsx` exactly — so route boundary → this fallback → live list
 * is one continuous shape with nothing moving at either hand-off.
 *
 * It no longer publishes a header title: `/folders` is a TOP-LEVEL screen,
 * whose bar carries none. See `CasesScreen` for the full note.
 */
export function FoldersScreen() {
  return (
    <Suspense fallback={<FoldersFallback />}>
      <FoldersBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the title, the count row and the search field as reserved
 * shapes for the real controls (chrome, not content: the live screen puts the
 * real field and the real count on those pixels), over the list skeleton, which
 * pulses here exactly as it does on the live screen (standards §8i). A wait is
 * a wait, and the reader cannot tell an RSC payload from a query. Identical to
 * `app/v2/folders/(library)/loading.tsx`, which imports this component so the
 * two can never drift.
 *
 * The "New folder" pill IS still reserved here, unlike the notes library's "New
 * note": that one has moved out of the flow into the floating dock, while this
 * one is still an inline control (see `FoldersBrowser` — the owner named three
 * screens for a floating action and this was not one of them). It exists for
 * every signed-in reader, so reserving it prevents a jump rather than leaving a
 * permanent gap.
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
        <ScreenTitle />
        {searchAtTop ? <SearchFieldShape className="mb-3" /> : null}
        <div className="mb-3 flex min-h-9 items-center justify-end">
          <div className="h-9 w-9 rounded-full bg-primary/60 sm:w-32" />
        </div>
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
