'use client';

import { Suspense } from 'react';

import { FoldersBrowser } from './FoldersBrowser';
import { FoldersFallback } from './FoldersFallback';

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
