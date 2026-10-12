'use client';

import { Suspense } from 'react';

import { NotesBrowser } from './NotesBrowser';
import { NotesFallback } from './NotesFallback';

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
