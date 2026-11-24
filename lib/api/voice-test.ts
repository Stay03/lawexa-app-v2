import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { VoiceCallEnded, VoiceServerTurns, VoiceTestMode, VoiceTestSession } from '@/types/voice-test';

/**
 * The staff live-voice test page (thread ac47b1df; Backend fe2736bd). Every
 * route answers 403 errors.reason no_access without `user.can_record`, and
 * 503 not_set_up before the voice agents exist. Out of messages, a `b` call
 * is refused at start with typed chat's own 403 (`errors.code`
 * ai_messages_exhausted and its block).
 */
export const voiceTestApi = {
  /** A call's session: the single-use token, the voices, and what to pass to the call. */
  start: async (mode: VoiceTestMode, voiceId?: string): Promise<ApiResponse<VoiceTestSession>> => {
    const response = await apiClient.post<ApiResponse<VoiceTestSession>>('/voice-test/sessions', {
      mode,
      ...(voiceId && { voice_id: voiceId }),
    });
    return response.data;
  },

  /** The server's timings per turn of a `c` call (a `b` call has none: ElevenLabs answers it). */
  turns: async (sessionUuid: string): Promise<ApiResponse<VoiceServerTurns>> => {
    const response = await apiClient.get<ApiResponse<VoiceServerTurns>>(`/voice-test/sessions/${sessionUuid}/turns`);
    return response.data;
  },

  /**
   * A Lawexa voice call's research result went into the call: the server
   * notes when the read-back started, and refuses a yes to a held action until
   * it has had time to be said (Backend, branch voice-held-actions). Sent once
   * per research turn; never for an `action-<code>` outcome.
   */
  resultSent: async (sessionUuid: string, turnUuid: string): Promise<void> => {
    await apiClient.post(`/voice-test/sessions/${sessionUuid}/turns/${turnUuid}/sent`);
  },

  /**
   * The voice was cut off while reading a result: the reply in full and the
   * part the caller heard, so the server keeps the unread rest and "carry on"
   * reads exactly that (Stay's option B, 24 November 2026; Backend branch
   * voice-cut-point). The turn is the one whose result the page last sent in.
   */
  cut: async (sessionUuid: string, turnUuid: string, cut: { full: string; spoken: string }): Promise<void> => {
    await apiClient.post(`/voice-test/sessions/${sessionUuid}/turns/${turnUuid}/cut`, cut);
  },

  /**
   * The call ended; the server records its length and cost. `leaving`: the
   * tab is closing, so the request is sent with fetch's keepalive and outlives
   * the page.
   */
  end: async (
    sessionUuid: string,
    providerConversationId: string | null,
    { leaving = false }: { leaving?: boolean } = {},
  ): Promise<ApiResponse<VoiceCallEnded>> => {
    const response = await apiClient.post<ApiResponse<VoiceCallEnded>>(
      `/voice-test/sessions/${sessionUuid}/end`,
      providerConversationId ? { provider_conversation_id: providerConversationId } : {},
      leaving ? { adapter: 'fetch', fetchOptions: { keepalive: true } } : undefined,
    );
    return response.data;
  },
};
