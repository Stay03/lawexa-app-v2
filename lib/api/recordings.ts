import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type {
  Recording,
  RecordingListPage,
  RecordingLiveConfig,
  RecordingStart,
  RecordingTargetInput,
} from '@/types/recording';

/**
 * Recording a meeting (thread ac47b1df; Backend's server half, section 3).
 * Staff only at first: every route answers 403 without `user.can_record`.
 *
 * The browser sends the microphone straight to the live transcriber with the
 * single-use token `create` returns; our server carries no live audio. The
 * saved audio goes up here in 30-second pieces while recording, so a closed
 * tab or a dead phone loses at most the last piece.
 */
export const recordingsApi = {
  /** Start a recording in a chat or a Space thread. The server builds the keyterms here. */
  create: async (target: RecordingTargetInput, audioMime: string): Promise<ApiResponse<RecordingStart>> => {
    const response = await apiClient.post<ApiResponse<RecordingStart>>('/recordings', { ...target, audio_mime: audioMime });
    return response.data;
  },

  /** A fresh single-use token for the same recording: a dropped live socket, or the token's 15 minutes passed. */
  liveToken: async (uuid: string): Promise<ApiResponse<{ live: RecordingLiveConfig }>> => {
    const response = await apiClient.post<ApiResponse<{ live: RecordingLiveConfig }>>(`/recordings/${uuid}/live-token`);
    return response.data;
  },

  /** One piece of the saved audio, numbered from 0. Sending the same number again is safe. */
  uploadChunk: async (uuid: string, seq: number, chunk: Blob): Promise<ApiResponse<{ seq: number }>> => {
    const body = new FormData();
    body.append('seq', String(seq));
    body.append('chunk', chunk, `piece-${seq}`);
    const response = await apiClient.post<ApiResponse<{ seq: number }>>(`/recordings/${uuid}/chunks`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * "Still here", about once a minute while a recording is open, paused or not.
   * The server closes a recording that hears nothing (no piece, no keepalive)
   * for 10 minutes; 409 recording_stopped says it already did.
   */
  keepalive: async (uuid: string, paused: boolean): Promise<ApiResponse<{ received: boolean }>> => {
    const response = await apiClient.post<ApiResponse<{ received: boolean }>>(`/recordings/${uuid}/keepalive`, { paused });
    return response.data;
  },

  /** Stop: the server joins the pieces, saves the audio and writes the final transcript. 409 names missing pieces. */
  stop: async (
    uuid: string,
    body: { last_seq: number; duration_seconds: number; paused_seconds: number },
  ): Promise<ApiResponse<Recording>> => {
    const response = await apiClient.post<ApiResponse<Recording>>(`/recordings/${uuid}/stop`, body);
    return response.data;
  },

  get: async (uuid: string): Promise<ApiResponse<Recording>> => {
    const response = await apiClient.get<ApiResponse<Recording>>(`/recordings/${uuid}`);
    return response.data;
  },

  /** The person's own recordings, newest first (Files, Recordings tab). */
  list: async (params: { page?: number; per_page?: number } = {}): Promise<RecordingListPage> => {
    const response = await apiClient.get<RecordingListPage>('/recordings', { params });
    return response.data;
  },

  /** Run a failed step again, from where it failed. The audio is never lost on a failure. */
  retry: async (uuid: string): Promise<ApiResponse<Recording>> => {
    const response = await apiClient.post<ApiResponse<Recording>>(`/recordings/${uuid}/retry`);
    return response.data;
  },
};
