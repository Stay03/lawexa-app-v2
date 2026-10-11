import type { Metadata } from 'next';

import { DiscoverScreen } from '@/v2/features/spaces/discover/DiscoverScreen';

/** `/spaces/discover` — browse the public TEAM spaces. Researchers and above
 *  (Stay, 11 October 2026); everyone else meets the Team Channels panel inside
 *  `DiscoverScreen`. New Spaces are private and never listed here. */
export const metadata: Metadata = {
  title: 'Find a space',
  robots: { index: false, follow: false },
};

export default function DiscoverPage() {
  return <DiscoverScreen />;
}
