import { dictationApi } from '@/lib/api/dictation';
import type { VoiceClip } from '@/types/dictation';

/**
 * A dictated message's voice, sent AFTER its words (Arthur, 27 November 2026:
 * "after send the text vanishes momentarily and it's terrible UX"). The words
 * go at once; the clip waits here, keyed, until the send names the message it
 * was saved as, then goes up as POST /dictation/clips with that message_id
 * (Backend dictation-clip-after-send). The row under the question reads the
 * state by key: saving, then kept, or failed with a way to try again. The
 * words never move.
 *
 * A module store (not React state): the upload outlives the box that sent it,
 * as a homepage send opens the chat page while its voice is still going up.
 */

export type HeldVoiceState = 'waiting' | 'saving' | 'kept' | 'failed';

interface HeldVoice {
  clip: Blob;
  durationMs: number;
  state: HeldVoiceState;
  messageId: number | null;
}

/** Tries per upload before the row offers Try again. */
export const VOICE_TRIES = 3;
const RETRY_AFTER_MS = 1_500;

const held = new Map<string, HeldVoice>();
const listeners = new Set<() => void>();
let nextKey = 0;

function emit() {
  for (const listener of listeners) listener();
}

function setState(key: string, state: HeldVoiceState) {
  const voice = held.get(key);
  if (!voice || voice.state === state) return;
  held.set(key, { ...voice, state });
  emit();
}

/** Keep a clip until its message is saved; the key rides the message as `voiceClip.pending`. */
export function holdVoice(clip: Blob, durationMs: number): string {
  nextKey += 1;
  const key = `voice-${Date.now()}-${nextKey}`;
  held.set(key, { clip, durationMs, state: 'waiting', messageId: null });
  return key;
}

/** The message was not sent: its voice goes too. */
export function dropVoice(key: string): void {
  if (held.delete(key)) emit();
}

/** The send named its saved message: the voice goes up, linked to it. */
export async function sendHeldVoice(
  key: string,
  messageId: number,
  upload: typeof dictationApi.uploadClip = dictationApi.uploadClip,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<HeldVoiceState> {
  const voice = held.get(key);
  if (!voice) return 'failed';
  if (voice.state === 'saving' || voice.state === 'kept') return voice.state;
  held.set(key, { ...voice, messageId, state: 'saving' });
  emit();
  for (let attempt = 1; attempt <= VOICE_TRIES; attempt += 1) {
    try {
      const answer = await upload(voice.clip, voice.durationMs, messageId);
      // A server from before message_id stores the clip without linking it: not kept.
      const kept = answer.data !== null && answer.data.message_id === messageId;
      setState(key, kept ? 'kept' : 'failed');
      return kept ? 'kept' : 'failed';
    } catch (error) {
      // A refusal is final (no access, a private-mode chat, already has a voice); a dropped upload tries again.
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (status !== undefined && status >= 400 && status < 500) break;
      if (attempt < VOICE_TRIES) await wait(RETRY_AFTER_MS * attempt);
    }
  }
  setState(key, 'failed');
  return 'failed';
}

/** Try again (the row's button): the same clip, the same message. */
export function retryHeldVoice(key: string): void {
  const voice = held.get(key);
  if (!voice || voice.state !== 'failed' || voice.messageId === null) return;
  held.set(key, { ...voice, state: 'waiting' });
  void sendHeldVoice(key, voice.messageId);
}

/**
 * The voice line for a held clip, as a box draws it on its own question: it
 * plays from memory, and the key lets the row follow the upload. The chat page
 * builds it from the key a homepage send hands over, since the clip itself
 * stays here (Lucy's check, 27 November 2026: "Saving the voice…" never showed
 * after a homepage send). Null once the clip is gone (not sent, or dropped).
 */
export function heldVoiceClip(key: string): VoiceClip | null {
  const voice = held.get(key);
  if (!voice) return null;
  return { id: 0, url: URL.createObjectURL(voice.clip), duration_ms: Math.round(voice.durationMs), pending: key };
}

export function heldVoiceState(key: string): HeldVoiceState | null {
  return held.get(key)?.state ?? null;
}

export function subscribeHeldVoices(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
