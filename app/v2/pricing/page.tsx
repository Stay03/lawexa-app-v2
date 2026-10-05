import type { Metadata } from 'next';
import { PricingScreen } from '@/v2/features/pricing/PricingScreen';

/**
 * v2 `/pricing`: the plans, the period and currency switches, message packs,
 * and starting a payment. `v2/routes.manifest.ts` claims this EXACT path;
 * v1's `/upgrade` redirects here, so it needs no entry of its own.
 *
 * NOINDEX, unlike v1's page, which is in the sitemap. `/subscriptions/plans`
 * answers 401 without a session, so a crawler would index a sign-in prompt.
 * When the backend serves plans to a visitor with no session, this page can
 * prefetch them and join the sitemap like `/cases`.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Pricing',
    description: 'Lawexa plans, message packs and enterprise plans, with prices.',
    robots: { index: false, follow: false },
  };
}

/** Every read is a client query the screen owns; the segment awaits nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2PricingPage() {
  return <PricingScreen />;
}
