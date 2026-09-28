import type { Metadata } from 'next';
import { BillingScreen } from '@/v2/features/settings/billing/BillingScreen';

/**
 * v2 `/settings/billing`: the plan, the invoices and cancelling.
 * `v2/routes.manifest.ts` claims this EXACT path. Private surface conventions
 * as on `/settings`.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Billing',
    description: 'Your plan, your invoices, and cancelling.',
    robots: { index: false, follow: false },
  };
}

/** Every read is a client query the screen owns; the segment awaits nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2BillingPage() {
  return <BillingScreen />;
}
