import type { Metadata } from 'next';

import { DiscoverScreen } from '@/v2/features/spaces/discover/DiscoverScreen';

/** `/spaces/discover` — browse the spaces anybody may join. Guests may read it;
 *  joining needs an account, and the refusal says so rather than failing quietly. */
export const metadata: Metadata = {
  title: 'Find a space',
  robots: { index: false, follow: false },
};

export default function DiscoverPage() {
  return <DiscoverScreen />;
}
