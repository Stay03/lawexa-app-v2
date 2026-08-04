import { CollabAccessGate } from '@/v2/features/collab/access';

/**
 * v2 `/invitations` — the segment layout, mounting the SAME collab audience
 * gate as `/spaces` and `/channels` (owner decision D1; phase-5 W1 item 7).
 * The three doors share one component so they can never drift.
 *
 * A layout does NOT re-render on a soft navigation, so the check runs once per
 * full page load; and an ineligible viewer never renders the inbox, its
 * queries or its route fallback at all — the gate short-circuits above the
 * `<Suspense>` that `loading.tsx` compiles into.
 *
 * A SERVER layout rendering a `'use client'` gate, per the v2 convention:
 * children stay server components, passed through untouched.
 *
 * LIVE SINCE W5: `/invitations` is in `v2/routes.manifest.ts`, and so are the
 * three legacy paths (`/channel-invitations`, `/space-invitations`,
 * `/organization-invitations`), each a redirect shell onto this one — so old
 * notification `action_url`s keep working (owner decision D5).
 */
export default function V2InvitationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CollabAccessGate>{children}</CollabAccessGate>;
}
