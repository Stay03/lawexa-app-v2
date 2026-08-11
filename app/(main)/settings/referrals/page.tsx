import type { Metadata } from 'next';

import { ReferralScreen } from '@/components/ambassadors/ReferralScreen';

/**
 * `/settings/referrals` — an ambassador's code and link, where @arthur asked
 * for it (2026-08-11: "referral page should be in settings").
 *
 * ── TWO ADDRESSES, ONE SCREEN, AND BOTH HAVE TO KEEP WORKING ───────────────
 * `/ambassadors/referrals` is already printed into the approval email that
 * @backendclaude sends, and an address in somebody's inbox cannot be moved
 * afterwards — the same reason a retired referral code keeps working. So this
 * is a second door onto the SAME component rather than a replacement, and
 * neither route owns any logic of its own.
 *
 * `noindex`: it is one person's own page and their code is on it.
 */
export const metadata: Metadata = {
  title: 'Your referral link',
  robots: { index: false, follow: false },
};

export default function SettingsReferralsPage() {
  return <ReferralScreen framing="settings" />;
}
