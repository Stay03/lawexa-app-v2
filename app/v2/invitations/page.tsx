import type { Metadata } from 'next';
import { InvitationsScreen } from '@/v2/features/invitations/InvitationsScreen';

/**
 * v2 `/invitations` — the server shell for the ONE invitations surface (owner
 * decision D5; study A7). v1 served the same view from four URLs; here there
 * is one, and the three legacy paths redirect onto it (W5).
 *
 * PRIVATE SURFACE CONVENTIONS: `noindex`, no canonical, no OG card, and NO
 * server prefetch — three per-account inboxes that a crawler must never see
 * and a server render could not usefully warm.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Invitations',
    description:
      'Pending invitations to organizations, spaces and channels.',
    robots: { index: false, follow: false },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — the same lever and
 * argument as `/bookmarks` and `/spaces`: the segment awaits nothing and
 * renders one client component, so a re-used payload cannot show old data; it
 * can only skip a round trip that produced nothing, and skipping it is what
 * keeps the cached inbox on screen instead of `loading.tsx`.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2InvitationsPage() {
  return <InvitationsScreen />;
}
