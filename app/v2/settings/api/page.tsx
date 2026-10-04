import type { Metadata } from 'next';
import { ApiKeysScreen } from '@/v2/features/settings/api/ApiKeysScreen';

/**
 * v2 `/settings/api`: API keys, shown as coming soon (owner, 4 October 2026).
 *
 * `v2/routes.manifest.ts` claims this EXACT path, as it does for the other
 * rebuilt options. Private surface conventions as on `/settings`: a bare title,
 * a description, and `noindex, nofollow`.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'API keys',
    description: 'API keys for your own tools and integrations, coming soon.',
    robots: { index: false, follow: false },
  };
}

/** The segment awaits nothing, so a re-used router payload can only skip a
 *  round trip that produced nothing (the same lever as `/settings`). */
export const unstable_dynamicStaleTime = 300;

export default function V2ApiKeysSettingsPage() {
  return <ApiKeysScreen />;
}
