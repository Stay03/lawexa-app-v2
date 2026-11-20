import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { UserBoxDoneResult, UserBoxReleaseResult, UserBoxStatus } from '@/types/user-box';

/**
 * Lawexa's machine (Userbox v1): the person's side, Researcher and above
 * (`role:researcher` on the routes). A refusal answers `{reason}` (`cap` 429
 * when every machine is in use, `busy` 409 when the waiting chat is still
 * answering, `off` when the machines are off).
 */
export const userBoxApi = {
  /** Who drives the machine, and the live view's address while the machines can be used. Each read issues a view token. */
  get: async (): Promise<ApiResponse<UserBoxStatus>> => {
    const response = await apiClient.get<ApiResponse<UserBoxStatus>>('/user-box');
    return response.data;
  },

  wake: async (): Promise<ApiResponse<UserBoxStatus>> => {
    const response = await apiClient.post<ApiResponse<UserBoxStatus>>('/user-box/wake');
    return response.data;
  },

  sleep: async (): Promise<ApiResponse<UserBoxStatus>> => {
    const response = await apiClient.post<ApiResponse<UserBoxStatus>>('/user-box/sleep');
    return response.data;
  },

  takeOver: async (): Promise<ApiResponse<UserBoxStatus>> => {
    const response = await apiClient.post<ApiResponse<UserBoxStatus>>('/user-box/take-over');
    return response.data;
  },

  /** Give the machine back; a chat that was waiting continues (`resumed`). */
  done: async (): Promise<ApiResponse<UserBoxDoneResult>> => {
    const response = await apiClient.post<ApiResponse<UserBoxDoneResult>>('/user-box/done');
    return response.data;
  },

  /**
   * Free the machine from the chat that holds it (Arthur's 5, thread
   * 38ad195b): 409 while that chat is mid-answer. With the chat it was freed
   * from, that chat carries on (Arthur's a, 20 November 2026).
   */
  release: async (conversationUuid?: string): Promise<ApiResponse<UserBoxReleaseResult>> => {
    const response = await apiClient.post<ApiResponse<UserBoxReleaseResult>>(
      '/user-box/release',
      conversationUuid ? { conversation_uuid: conversationUuid } : undefined,
    );
    return response.data;
  },
};
