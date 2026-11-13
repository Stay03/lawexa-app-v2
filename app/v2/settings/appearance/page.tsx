import { redirect } from 'next/navigation';

/**
 * LEGACY ADDRESS → `/settings`.
 *
 * v2 has no Appearance option (Stay, 13 November 2026, 52e78fa1: "Remove
 * appearance from the new settings page"). v1's page holds Reader Mode and the
 * agent-activity switch, which do nothing in v2, and the light/dark theme is in
 * the account menu. So a v2 reader who types or follows the old address lands
 * on the Settings list, by the same manifest-scoped, TEMPORARY-redirect
 * mechanism as the invitation shells (see `app/v2/channel-invitations/page.tsx`):
 * a v1 reader keeps `app/(main)/settings/appearance/page.tsx` untouched.
 *
 * Retire with v1, not before.
 */
export default function V2SettingsAppearanceRedirect(): never {
  redirect('/settings');
}
