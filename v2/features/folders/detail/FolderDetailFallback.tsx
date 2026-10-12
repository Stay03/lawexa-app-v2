'use client';

import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { FolderDetailSkeleton } from './states';

/**
 * The folder page's loading shape — its own skeleton, pulsing exactly as it
 * does on the live screen (standards §8i), in the shared column. A wait is a
 * wait: the reader cannot tell an RSC payload from a query, so one wait gets
 * one appearance. `FolderScreen` renders it as its Suspense fallback, and
 * `app/v2/folders/[uuid]/loading.tsx` and the `app/v2/folders` segment boundary
 * (which covers every list → folder click) render it too, so they can never
 * drift.
 *
 * ITS OWN FILE ON PURPOSE, for the reason `CaseFallback` gives: exported from
 * `FolderScreen.tsx`, this put the whole folder page (its queries, mutations
 * and dialogs) behind the folders LIST's loading screen. Nothing in this file
 * may import a screen.
 */
export function FolderDetailFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading this folder
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a Suspense fallback is
          DELETED, not reconciled, when content arrives — so anything focusable
          in here would lose focus and caret mid-interaction. */}
      <div aria-hidden inert className={LIST_COLUMN}>
        <FolderDetailSkeleton />
      </div>
    </>
  );
}
