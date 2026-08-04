'use client';

import { Suspense, useEffect } from 'react';

import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { NotesBrowser } from './NotesBrowser';
import { NotesListSkeleton } from './states';

/**
 * NotesScreen — the `/notes` client root. The two jobs of `CasesScreen` and
 * `StatutesScreen`, both ABOVE the `useSearchParams` boundary so neither
 * depends on the URL:
 *
 *  1. PUBLISHES the header centre-slot title ("Notes") on mount and clears it
 *     on unmount — an external-store write, not React state, which is what
 *     makes it legal inside an effect under the React Compiler lint.
 *  2. Wraps the `useSearchParams` consumer (`NotesBrowser` reads the tab and
 *     the search) in the Suspense boundary Next requires, with a fallback that
 *     mirrors `loading.tsx` exactly — so route boundary → this fallback → live
 *     list is one continuous shape with nothing moving at either hand-off.
 */
export function NotesScreen() {
  useEffect(() => {
    setHeaderContext({ title: 'Notes', confidential: false });
    return () => clearHeaderContext();
  }, []);

  return (
    <Suspense fallback={<NotesFallback />}>
      <NotesBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the search field and the tab strip as STILL RESERVED
 * SHAPES (they wait on no request, so they never pulse) over the real list
 * skeleton. Identical to `app/v2/notes/(library)/loading.tsx`, which imports
 * this component so the two can never drift.
 *
 * The "New note" affordance is NOT reserved here: whether it exists depends on
 * the viewer's role, and reserving space for a control that may never arrive
 * would leave a permanent gap beside the tabs for every guest.
 */
export function NotesFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading notes
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a Suspense fallback is
          DELETED, not reconciled, when content arrives — so anything focusable
          in here would lose focus and caret mid-interaction. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <SearchFieldShape className="mb-3" />
        <div className="mb-3 flex items-center">
          <div className="h-9 w-44 max-w-full rounded-full bg-secondary/60" />
        </div>
        <NotesListSkeleton still />
      </div>
    </>
  );
}
