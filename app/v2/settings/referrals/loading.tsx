import { ReferralsFallback } from '@/v2/features/settings/referrals/states';

/**
 * Route-level loading boundary for `/settings/referrals`: the same silhouette
 * the screen draws while it reads.
 */
export default function ReferralsLoading() {
  return <ReferralsFallback />;
}
