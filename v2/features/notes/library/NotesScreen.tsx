'use client';

import { Suspense } from 'react';

import { useSearchPosition } from '@/v2/search-position';
import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { NotesBrowser } from './NotesBrowser';
import { NotesListSkeleton } from './states';

/**
 * NotesScreen — the `/notes` client root. The job of `CasesScreen` and
 * `StatutesScreen`, ABOVE the `useSearchParams` boundary so it does not depend
 * on the URL: wrapping the `useSearchParams` consumer (`NotesBrowser` reads the
 * tab and the search) in the Suspense boundary Next requires, with a fallback
 * that mirrors `loading.tsx` exactly — so route boundary → this fallback → live
 * list is one continuous shape with nothing moving at either hand-off.
 *
 * It no longer publishes a header title: `/notes` is a TOP-LEVEL screen, whose
 * bar carries none. See `CasesScreen` for the full note.
 */
export function NotesScreen() {
  return (
    <Suspense fallback={<NotesFallback />}>
      <NotesBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the title, the tab strip and the search field as reserved
 * shapes for the real controls (chrome, not content: the live screen puts the
 * real field and the real tabs on those pixels), over the list skeleton, which
 * pulses here exactly as it does on the live screen (standards §8i). A wait is
 * a wait, and the reader cannot tell an RSC payload from a query. Identical to
 * `app/v2/notes/(library)/loading.tsx`, which imports this component so the two
 * can never drift.
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
