import { apiClient } from './client';
import type { DictationClipResponse, DictationLiveTokenResponse } from '@/types/dictation';

/**
 * Dictation REST client (Backend card 2b83c2ed). Both answer 403 to an account
 * without `can_dictate` (staff only at first). Every method returns the raw
 * `{ success, message, data }` envelope.
 */
export const dictationApi = {
  /** A single-use token for the live transcriber, as the recorder's `live` config. */
  liveToken: async (): Promise<DictationLiveTokenResponse> => {
    const response = await apiClient.post<DictationLiveTokenResponse>('/dictation/live-token');
    return response.data;
  },

  /**
   * Keep the voice of a dictated message. With `messageId` (the user message
   * the send saved) the clip goes up AFTER the words and the server links it
   * to that message; without, its id rides the send (`voice_clip_id`). Over 5
   * minutes or 10 MB is 422.
   */
  uploadClip: async (clip: Blob, durationMs: number, messageId?: number): Promise<DictationClipResponse> => {
    const body = new FormData();
    body.append('audio', clip, clip.type.includes('mp4') ? 'dictation.m4a' : 'dictation.webm');
    body.append('duration_ms', String(Math.round(durationMs)));
    if (messageId !== undefined) body.append('message_id', String(messageId));
    const response = await apiClient.post<DictationClipResponse>('/dictation/clips', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
