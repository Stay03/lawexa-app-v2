import type { Metadata } from 'next';
import { ReferralsScreen } from '@/v2/features/settings/referrals/ReferralsScreen';

/**
 * v2 `/settings/referrals`: an ambassador's link, results and codes.
 * `v2/routes.manifest.ts` claims this EXACT path, for v2 users only;
 * `/ambassadors/referrals` (in the approval email) keeps the shared screen.
 * `noindex`: it is one person's own page and their code is on it.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Referrals',
    description: 'Your referral link, what it brought, and your codes.',
    robots: { index: false, follow: false },
  };
}

/** Every read is a client query the screen owns; the segment awaits nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2ReferralsPage() {
  return <ReferralsScreen />;
}
