import type { Metadata } from 'next';
import { ActivityScreen } from '@/v2/features/activity/ActivityScreen';

/**
 * v2 `/activity` — server shell, on the private-list conventions of
 * `app/v2/conversations/page.tsx`: a bare title, a description, and `noindex`
 * because every row is the reader's own question. No canonical, no OG card.
 *
 * NO SERVER PREFETCH, deliberately, and here it is load-bearing: the rows are
 * grouped under the reader's LOCAL day and printed with the reader's LOCAL
 * time, which the server cannot know. The client query owns the rows, and the
 * list renders them only once mounted (see `ActivityList`).
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Activity',
    description: 'Every question you have asked Lawexa, by day.',
    robots: { index: false, follow: false },
  };
}

/**
 * Kept in the client router cache for 5 minutes, the lever and the safety
 * argument `app/v2/conversations/page.tsx` documents in full: this segment
 * awaits nothing and renders one client component, so a re-used payload can
 * only skip a round trip that produced nothing.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2ActivityPage() {
  return <ActivityScreen />;
}
