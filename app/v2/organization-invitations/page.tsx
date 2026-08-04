import { redirect } from 'next/navigation';

/**
 * LEGACY ADDRESS → `/invitations` (owner decision D5). See
 * `app/v2/channel-invitations/page.tsx` for why this is a manifest-scoped,
 * TEMPORARY redirect to the clean path — the three legacy invitation URLs
 * share one mechanism and one reasoning.
 */
export default function V2OrganizationInvitationsRedirect(): never {
  redirect('/invitations');
}
