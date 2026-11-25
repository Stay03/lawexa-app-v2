/**
 * Dictation in the message box (Arthur, 25 November 2026, thread ce4eb347:
 * design A2, staff first). Backend's shapes, agreed the same day (server card
 * 2b83c2ed). The live words come from the same transcriber as the meeting
 * recorder, opened with the same live config.
 */

import type { RecordingLiveConfig } from './recording';

/** `POST /dictation/live-token`: a single-use token for the live transcriber; ask again for a long dictation. */
export interface DictationLiveTokenResponse {
  success: boolean;
  message: string;
  data: { live: RecordingLiveConfig } | null;
}

/** `POST /dictation/clips`: the voice of one dictated message, kept as a file of the person's own. */
export interface DictationClipResponse {
  success: boolean;
  message: string;
  data: { id: number; duration_ms: number } | null;
}

/** A message's kept voice, as the message resource carries it. The url is signed and short-lived. */
export interface VoiceClip {
  id: number;
  url: string;
  duration_ms: number;
}

/** The longest clip the server keeps (5 minutes); dictation stops listening there. */
export const DICTATION_MAX_MS = 5 * 60 * 1000;
