import type { VoiceResearchReadyEvent } from '@/types/voice-test';

/**
 * `.voice.research_ready` (Backend, 21 November 2026: on the person's private
 * channel, when a `c` call's research is done), passed from the realtime
 * spine to the open voice test page.
 */
const listeners = new Set<(event: VoiceResearchReadyEvent) => void>();

export function onVoiceResearchReady(listener: (event: VoiceResearchReadyEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitVoiceResearchReady(event: VoiceResearchReadyEvent): void {
  for (const listener of listeners) listener(event);
}
