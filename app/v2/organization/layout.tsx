import { CollabAccessGate } from '@/v2/features/collab/access';

/**
 * v2 `/organization` — the segment layout, mounting the SAME collab audience
 * gate as `/spaces`, `/channels` and `/invitations` (owner decision D1;
 * phase-5 W1 item 7). One gate component, four doors, no drift.
 *
 * THE ROUTE IS TOP-LEVEL, NOT UNDER SETTINGS (owner decision D7): v2 has no
 * settings surface, and an organization is a thing you visit — an identity
 * with members and a verification state — rather than a preference you tune.
 *
 * A SERVER layout rendering a `'use client'` gate, per the v2 convention. The
 * gate is synchronous (it reads the session snapshot the v2 layout already
 * resolved), so there is no pending branch and no flash.
 *
 * ROUTES STAY DARK: no `v2/routes.manifest.ts` entry until W5.
 */
export default function V2OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CollabAccessGate>{children}</CollabAccessGate>;
}
