import { BillingFallback } from '@/v2/features/settings/billing/states';

/**
 * Route-level loading boundary for `/settings/billing`: the same silhouette the
 * screen draws while it reads, so the hand-off moves nothing.
 */
export default function BillingLoading() {
  return <BillingFallback />;
}
