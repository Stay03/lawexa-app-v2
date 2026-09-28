import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PaymentCallback } from '@/v2/features/settings/message-packs/PaymentCallback';

/**
 * v2 `/payg/callback`: where the payment provider returns a v2 buyer of message
 * packs. `v2/routes.manifest.ts` claims this EXACT path, so v1 buyers keep
 * v1's page at the same address.
 *
 * `useSearchParams` needs a Suspense boundary to prerender.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Confirming payment',
    robots: { index: false, follow: false },
  };
}

export default function V2PaygCallbackPage() {
  return (
    <Suspense fallback={null}>
      <PaymentCallback />
    </Suspense>
  );
}
