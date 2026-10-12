'use client';

import { STATUTE_COLUMN, StatuteDocumentSkeleton } from './states';

/**
 * The statute reader's loading shape — what `app/v2/statutes/[slug]/loading.tsx`
 * and the `app/v2/statutes` segment boundary render.
 *
 * ITS OWN FILE ON PURPOSE, for the reason `CaseFallback` gives: exported from
 * `StatuteScreen.tsx`, this put the whole statute reader behind the statutes
 * LIST's loading screen. Nothing in this file may import a screen.
 */
export function StatuteFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading statute
      </span>
      <div aria-hidden inert className={STATUTE_COLUMN}>
        <StatuteDocumentSkeleton />
      </div>
    </>
  );
}
