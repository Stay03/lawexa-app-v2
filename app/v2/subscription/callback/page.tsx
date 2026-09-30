import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PlanPaymentCallback } from '@/v2/features/pricing/PlanPaymentCallback';

/**
 * v2 `/subscription/callback`: where the payment provider returns a v2 buyer. `v2/routes.manifest.ts`
 * claims this EXACT path, so v1 buyers keep v1's page at the same address.
 *
 * `useSearchParams` needs a Suspense boundary to prerender.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Confirming payment',
    robots: { index: false, follow: false },
  };
}

export default function V2SubscriptionCallbackPage() {
  return (
    <Suspense fallback={null}>
      <PlanPaymentCallback kind="subscribe" />
    </Suspense>
  );
}
