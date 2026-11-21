import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { VoiceServerTurns, VoiceTestMode, VoiceTestSession } from '@/types/voice-test';

/**
 * The staff live-voice test page (thread ac47b1df; Backend fe2736bd). Every
 * route answers 403 errors.reason no_access without `user.can_record`, and
 * 503 not_set_up before the voice agents exist.
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
   * The call ended; the server records its length and cost. `leaving`: the
   * tab is closing, so the request is sent with fetch's keepalive and outlives
   * the page.
   */
  end: async (
    sessionUuid: string,
    providerConversationId: string | null,
    { leaving = false }: { leaving?: boolean } = {},
  ): Promise<ApiResponse<{ session_uuid: string; duration_seconds: number }>> => {
    const response = await apiClient.post<ApiResponse<{ session_uuid: string; duration_seconds: number }>>(
      `/voice-test/sessions/${sessionUuid}/end`,
      providerConversationId ? { provider_conversation_id: providerConversationId } : {},
      leaving ? { adapter: 'fetch', fetchOptions: { keepalive: true } } : undefined,
    );
    return response.data;
  },
};
