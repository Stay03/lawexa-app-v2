import type { Metadata } from 'next';
import { NotificationsScreen } from '@/v2/features/notifications/NotificationsScreen';

/**
 * v2 `/notifications` — server shell for the inbox. The v2 metadata convention
 * (`app/v2/layout.tsx` docblock): a server `page.tsx` exporting
 * `generateMetadata` that renders a `'use client'` child.
 *
 * PRIVATE SURFACE CONVENTIONS, the `/bookmarks` and `/invitations` precedent: a
 * bare title, a description, `noindex, nofollow`, no canonical, no OG card.
 *
 * NO SERVER PREFETCH, deliberately, and it is load-bearing beyond cost: rows
 * are per-account and nothing here is crawlable, and the rows carry relative
 * times and day headers in the READER's clock and zone. The client renders
 * them only once mounted (`NotificationsInbox`), so a prefetch would buy
 * nothing on first paint.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Notifications',
    description: 'Mentions, invitations and everything else waiting for you, newest first.',
    robots: { index: false, follow: false },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — the same lever and
 * safety argument as `app/v2/bookmarks/page.tsx`: the segment awaits nothing
 * and renders one client component, so a re-used payload cannot show old data;
 * it can only skip a round trip, and skipping it keeps the cached rows on
 * screen instead of `loading.tsx`.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2NotificationsPage() {
  return <NotificationsScreen />;
}
