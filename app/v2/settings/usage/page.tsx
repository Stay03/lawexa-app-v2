import type { Metadata } from 'next';
import { UsageScreen } from '@/v2/features/settings/usage/UsageScreen';

/**
 * v2 `/settings/usage`: the plan, the AI messages left, the pack balance and
 * the other limits, as the server counts them. `v2/routes.manifest.ts` claims
 * this EXACT path. Private surface conventions as on `/settings`.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Usage',
    description: 'What your plan allows and what you have used.',
    robots: { index: false, follow: false },
  };
}

/** Every read is a client query the screen owns; the segment awaits nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2UsagePage() {
  return <UsageScreen />;
}
