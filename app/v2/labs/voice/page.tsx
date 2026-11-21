import type { Metadata } from 'next';

import { VoiceTestScreen } from '@/v2/features/voice-test/VoiceTestScreen';

/**
 * v2 `/labs/voice`: the staff live-voice test page (thread ac47b1df). Staff
 * only (`user.can_record`) and linked from no menu; `v2/routes.manifest.ts`
 * claims this EXACT path.
 */
export const metadata: Metadata = {
  title: 'Voice test',
  robots: { index: false, follow: false },
};

export default function V2VoiceTestPage() {
  return <VoiceTestScreen />;
}
