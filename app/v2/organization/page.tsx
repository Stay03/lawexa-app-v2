import type { Metadata } from 'next';
import { OrganizationScreen } from '@/v2/features/organizations/OrganizationScreen';

/**
 * v2 `/organization` — the server shell for the caller's organization (owner
 * decision D7: top-level, not under settings).
 *
 * PRIVATE SURFACE CONVENTIONS: `noindex`, no canonical, no OG card and NO
 * server prefetch. `GET /my-organization` answers a different organization for
 * every viewer — and `null` for most — so there is nothing a server render
 * could usefully warm and nothing a crawler should ever see.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Organization',
    description:
      'Your organization — members, details and verification.',
    robots: { index: false, follow: false },
  };
}

/** Same client-router-cache lever as the other private v2 surfaces: this
 *  segment awaits nothing and renders one client component, so a re-used
 *  payload can only skip a round trip that produced nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2OrganizationPage() {
  return <OrganizationScreen />;
}
