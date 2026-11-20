import type { Metadata } from 'next';
import { MyTemplatesScreen } from '@/v2/features/private-items/MyTemplatesScreen';

/**
 * v2 `/settings/templates`: the person's own document templates (Stay, thread
 * 9ae498ae). v2 only; `v2/routes.manifest.ts` claims this EXACT path.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'My templates',
    description: 'Your own document templates, which Lawexa drafts from in your chats.',
    robots: { index: false, follow: false },
  };
}

/** The list is read by a client query the screen owns; the segment awaits nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2MyTemplatesPage() {
  return <MyTemplatesScreen />;
}
