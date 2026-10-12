'use client';

import { NOTE_COLUMN, NoteDocumentSkeleton } from './states';

/**
 * The note reader's loading shape — what `app/v2/notes/[slug]/loading.tsx` and
 * the `app/v2/notes` segment boundary render, so boundary → live document is
 * one continuous shape and nothing moves at the hand-off.
 *
 * ITS OWN FILE ON PURPOSE, for the reason `CaseFallback` gives: exported from
 * `NoteScreen.tsx`, this put the whole note reader behind the notes LIST's
 * loading screen. Nothing in this file may import a screen.
 */
export function NoteFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading note
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a route fallback is
          DELETED, not reconciled, when content arrives, so anything focusable
          in here would lose focus mid-interaction. */}
      <div aria-hidden inert className={NOTE_COLUMN}>
        <NoteDocumentSkeleton />
      </div>
    </>
  );
}
