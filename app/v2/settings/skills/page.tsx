import type { Metadata } from 'next';
import { MySkillsScreen } from '@/v2/features/private-items/MySkillsScreen';

/**
 * v2 `/settings/skills`: the person's own skills (Stay, thread 9ae498ae). v2
 * only; `v2/routes.manifest.ts` claims this EXACT path.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'My skills',
    description: 'Your own skills, the steps Lawexa follows in your chats.',
    robots: { index: false, follow: false },
  };
}

/** The list is read by a client query the screen owns; the segment awaits nothing. */
export const unstable_dynamicStaleTime = 300;

export default function V2MySkillsPage() {
  return <MySkillsScreen />;
}
