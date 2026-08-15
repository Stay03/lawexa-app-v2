'use client';

import { Suspense, useEffect } from 'react';

import { SearchFieldShape } from '@/v2/shell/SearchField';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { FoldersBrowser } from './FoldersBrowser';
import { FoldersListSkeleton } from './states';

/**
 * FoldersScreen — the `/folders` client root. The two jobs `NotesScreen` and
 * `CasesScreen` do, both ABOVE the `useSearchParams` boundary so neither
 * depends on the URL:
 *
 *  1. PUBLISHES the header centre-slot title ("Folders") on mount and clears it
 *     on unmount — an external-store write, not React state, which is what
 *     makes it legal inside an effect under the React Compiler lint.
 *  2. Wraps the `useSearchParams` consumer (`FoldersBrowser` reads the search)
 *     in the Suspense boundary Next requires, with a fallback that mirrors
 *     `loading.tsx` exactly — so route boundary → this fallback → live list is
 *     one continuous shape with nothing moving at either hand-off.
 */
export function FoldersScreen() {
  useEffect(() => {
    setHeaderContext({ title: 'Folders', confidential: false });
    return () => clearHeaderContext();
  }, []);

  return (
    <Suspense fallback={<FoldersFallback />}>
      <FoldersBrowser />
    </Suspense>
  );
}

/**
 * Suspense fallback — the search field and the action row as reserved shapes
 * for the real controls (chrome, not content: the live screen puts the real
 * field and the real pill on those pixels), over the list skeleton, which
 * pulses here exactly as it does on the live screen (standards §8i). A wait is
 * a wait, and the reader cannot tell an RSC payload from a query. Identical to
 * `app/v2/folders/(library)/loading.tsx`, which imports this component so the
 * two can never drift.
 *
 * The "New folder" pill IS reserved here, unlike the notes library's "New
 * note": that one is role-gated and may never arrive, while this one exists for
 * every signed-in reader — which is every reader who gets past the sign-in
 * state — so reserving it prevents a jump rather than leaving a permanent gap.
 */
export function FoldersFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your folders
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a Suspense fallback is
          DELETED, not reconciled, when content arrives — so anything focusable
          in here would lose focus and caret mid-interaction. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <SearchFieldShape className="mb-3" />
        <div className="mb-3 flex min-h-9 items-center justify-end">
          <div className="h-9 w-9 rounded-full bg-primary/60 sm:w-32" />
        </div>
        <FoldersListSkeleton />
      </div>
    </>
  );
}
