import { PricingFallback } from '@/v2/features/pricing/states';

/**
 * Route-level loading boundary for `/pricing`: the same silhouette the screen
 * draws while it reads, so the hand-off moves nothing.
 */
export default function PricingLoading() {
  return <PricingFallback />;
}
