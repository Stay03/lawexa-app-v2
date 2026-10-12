'use client';

import { CASE_COLUMN, CaseDocumentSkeleton } from './states';

/**
 * The case page's loading shape: the document skeleton at the real geometry.
 * `CaseScreen` renders it as its Suspense fallback, `CaseLoading` while the
 * memory cache holds nothing drawable, and the `app/v2/cases` segment boundary
 * for every list → case click.
 *
 * ITS OWN FILE ON PURPOSE. A loading boundary ships every module its imports
 * reach, before the page it stands in for has arrived. Exported from
 * `CaseScreen.tsx`, this put the whole case reader (the document, the outline,
 * the chat) behind the cases LIST's loading screen; here it reaches only the
 * skeleton. Nothing in this file may import a screen.
 */
export function CaseFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading case
      </span>
      <div aria-hidden inert className={CASE_COLUMN}>
        <CaseDocumentSkeleton />
      </div>
    </>
  );
}
