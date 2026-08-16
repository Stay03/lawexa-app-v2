import type { Metadata } from 'next';
import { ProfileScreen } from '@/v2/features/settings/profile/ProfileScreen';

/**
 * v2 `/settings/profile`: the server shell for the profile form, and the FIRST
 * settings option to leave v1.
 *
 * `v2/routes.manifest.ts` claims this EXACT path, not a wildcard: the other
 * settings pages keep falling through to the classic app until each is rebuilt,
 * and a wildcard here would swallow twelve of them into a tree that has no page
 * for any of them.
 *
 * PRIVATE SURFACE CONVENTIONS, as on `/settings` beside it: a bare `title` (the
 * root '%s | Lawexa' template appends the brand), a description, and
 * `robots: noindex, nofollow`. No canonical and no OG card, because this page is
 * one person's own account. No server prefetch either: the segment awaits
 * nothing and the account is read by a client query the screen owns, which is
 * what lets the route fallback paint immediately.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Profile',
    description: 'Your name, handle and the details people see about you.',
    robots: { index: false, follow: false },
  };
}

/** Same router-cache lever and safety argument as `/settings` above it: the
 *  route is dynamic (the v2 layout reads the session cookie), this segment
 *  awaits nothing, and a re-used payload can only skip a round trip that
 *  produced nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2ProfileSettingsPage() {
  return <ProfileScreen />;
}
