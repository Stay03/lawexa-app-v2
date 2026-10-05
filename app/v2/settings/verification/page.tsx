import type { Metadata } from 'next';
import { VerificationScreen } from '@/v2/features/settings/verification/VerificationScreen';

/**
 * v2 `/settings/verification`: a lawyer's verification, from the documents to
 * the decision. Rebuilt from v1's `/lawyer-verification`, which now redirects
 * here for a v2 reader. `v2/routes.manifest.ts` claims this EXACT path.
 * Private surface conventions as on `/settings`.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Lawyer verification',
    description: 'Send your documents and follow your lawyer verification.',
    robots: { index: false, follow: false },
  };
}

/** The profile is read by a client query the screen owns; the segment awaits
 *  nothing, so a re-used router payload can only skip an empty round trip. */
export const unstable_dynamicStaleTime = 300;

export default function V2VerificationSettingsPage() {
  return <VerificationScreen />;
}
