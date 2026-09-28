import type { Metadata } from 'next';
import { DeveloperScreen } from '@/v2/features/settings/developer/DeveloperScreen';

/**
 * v2 `/settings/developer`: the v2 switch and the search box position.
 *
 * `v2/routes.manifest.ts` claims this EXACT path, as it does for Profile, so
 * the other settings pages keep falling through to v1 until each is rebuilt.
 * Private surface conventions as on `/settings`: a bare title, a description,
 * and `noindex, nofollow`.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Developer',
    description: 'Preview switches for this browser.',
    robots: { index: false, follow: false },
  };
}

/** The segment awaits nothing, so a re-used router payload can only skip a
 *  round trip that produced nothing (the same lever as `/settings`). */
export const unstable_dynamicStaleTime = 300;

export default function V2DeveloperSettingsPage() {
  return <DeveloperScreen />;
}
