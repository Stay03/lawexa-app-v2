import type { Metadata } from 'next';
import { SettingsScreen } from '@/v2/features/settings/SettingsScreen';

/**
 * v2 `/settings` — the server shell for the settings home.
 *
 * THE BASE ONLY (owner, 16 August 2026). This claims the settings INDEX and
 * nothing under it: `v2/routes.manifest.ts` lists `'/settings'` as an EXACT
 * path, so `/settings/profile`, `/settings/billing` and the rest keep falling
 * through to v1 exactly as they do today, and each one joins v2 when it is
 * built. The screen's rows already point at them — see
 * `v2/features/settings/rows.ts`.
 *
 * PRIVATE SURFACE CONVENTIONS: a bare `title` (the root '%s | Lawexa' template
 * appends the brand), a description, and `robots: noindex, nofollow`. No
 * canonical and no OG card — both would advertise a page that is one person's
 * own account. No server prefetch either: the segment awaits nothing, and the
 * one thing this screen fetches (the current plan) is a client query the shell's
 * account row has usually already paid for.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Settings',
    description: 'Your account, plan and app preferences.',
    robots: { index: false, follow: false },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES — the same lever and
 * the same safety argument as `/bookmarks` and `/invitations`: the route is
 * dynamic (the v2 layout reads the session cookie) and Next's default
 * `staleTimes.dynamic` is 0, so without this every arrival re-fetches the
 * segment and `loading.tsx` covers the wait. This segment awaits nothing and
 * renders one client component, so a re-used payload cannot show old data; it
 * can only skip a round trip that produced nothing.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2SettingsPage() {
  return <SettingsScreen />;
}
