import { redirect } from 'next/navigation';

/**
 * LEGACY ADDRESS → `/organization` (owner decision D7: v2 has no settings
 * surface, and an organization is a thing you visit, not a preference).
 *
 * Same manifest-scoped, TEMPORARY-redirect mechanism as the three invitation
 * shells — see `app/v2/channel-invitations/page.tsx` for the full reasoning.
 * The manifest entry is the EXACT path `/settings/organization`, so the rest
 * of `/settings/*` still falls through to v1 untouched: this is the only
 * settings page v2 claims.
 */
export default function V2SettingsOrganizationRedirect(): never {
  redirect('/organization');
}
