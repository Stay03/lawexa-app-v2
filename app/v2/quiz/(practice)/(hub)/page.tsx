import type { Metadata } from 'next';
import { QuizHubScreen } from '@/v2/features/quiz/hub/QuizHubScreen';

/**
 * v2 `/quiz` — server shell for the quiz hub.
 *
 * Follows the v2 metadata convention (app/v2/layout.tsx docblock): a server
 * `page.tsx` exporting `generateMetadata` that renders a `'use client'` child.
 *
 * PRIVATE AND UNLISTED. This is a personal practice surface behind a
 * soft-launch audience, so it takes the `/conversations` treatment rather than
 * the `/cases` one: a bare title (the root "%s | Lawexa" template appends the
 * brand), a description, and `robots: noindex` — no canonical, no OG card.
 * Advertising a page that resolves to an early-access panel for almost every
 * visitor would be worse than not advertising it.
 *
 * NO SERVER PREFETCH, deliberately (the `/radars` precedent). Nothing here is
 * crawlable, so this segment awaits nothing: the client query cache owns the
 * rows, paints them instantly on return visits (30-minute `gcTime`) and
 * re-checks on every arrival (`REFETCH_ON_VISIT`) — which matters here because
 * a session can end or auto-abandon while the user is elsewhere.
 *
 * THE ROUTE GROUP IS LOAD-BEARING. `(hub)` exists so this page's shape lives in
 * `(hub)/loading.tsx` and wraps THIS page only. The segment-level
 * `app/v2/quiz/loading.tsx` wraps the CHILD slot (player / history / stats) and
 * is neutral, because those children share no shape. See `app/v2/loading.tsx`
 * for the rule and the bug it was written after.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Quiz',
    description:
      'Practise with multiple-choice questions drawn from your own study conversations.',
    robots: { index: false, follow: false },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — same lever and same
 * safety argument as `app/v2/radars/page.tsx`, which carries the full note. This
 * segment awaits nothing, so a re-used payload cannot show old data; it only
 * skips a round trip that produced nothing. The data itself still re-checks on
 * every arrival through the query layer.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2QuizHubPage() {
  return <QuizHubScreen />;
}
