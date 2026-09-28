import type { Metadata } from 'next';
import { DevicesScreen } from '@/v2/features/settings/devices/DevicesScreen';

/**
 * v2 `/settings/devices`: every device signed in to the account, and signing
 * them out. v2 only; v1 has no such page. `v2/routes.manifest.ts` claims this
 * EXACT path. Private surface conventions as on `/settings`.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Signed-in devices',
    description: 'The devices signed in to your account, and signing them out.',
    robots: { index: false, follow: false },
  };
}

/** The list is read by a client query the screen owns; the segment awaits
 *  nothing, so a re-used router payload can only skip an empty round trip. */
export const unstable_dynamicStaleTime = 300;

export default function V2DevicesSettingsPage() {
  return <DevicesScreen />;
}
