import type { Metadata } from 'next';
import { NotificationsScreen } from '@/v2/features/settings/notifications/NotificationsScreen';

/**
 * v2 `/settings/notifications`: how this device tells you about mentions.
 *
 * `v2/routes.manifest.ts` claims this EXACT path, as for Profile and
 * Developer. Private surface conventions as on `/settings`: a bare title, a
 * description, and `noindex, nofollow`.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Notifications',
    description: 'Mention alerts, sound, push and pause on this device.',
    robots: { index: false, follow: false },
  };
}

/** The segment awaits nothing (the screen reads device stores on the client),
 *  so a re-used router payload can only skip a round trip that produced
 *  nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2NotificationSettingsPage() {
  return <NotificationsScreen />;
}
