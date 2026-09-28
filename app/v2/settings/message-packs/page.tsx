import type { Metadata } from 'next';
import { MessagePacksScreen } from '@/v2/features/settings/message-packs/MessagePacksScreen';

/**
 * v2 `/settings/message-packs`: the pack balance, buying, the purchase history
 * and how packs are spent. `v2/routes.manifest.ts` claims this EXACT path.
 * Private surface conventions as on `/settings`.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Message packs',
    description: 'Your message pack balance, buying more, and what you bought.',
    robots: { index: false, follow: false },
  };
}

/** Every read is a client query the screen owns; the segment awaits nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2MessagePacksPage() {
  return <MessagePacksScreen />;
}
