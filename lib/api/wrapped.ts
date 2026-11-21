import { AxiosError } from 'axios';

import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { WrappedRecord } from '@/lib/wrapped/types';
import type { WrappedProgress } from '@/lib/wrapped/progress';
import type { Wrapped26Record } from '@/lib/wrapped26/types';
import type { Wrapped26Progress } from '@/lib/wrapped26/progress';
import { fetchWrapped26Window, type Wrapped26Window } from '@/lib/wrapped26/window';

/**
 * Lawexa Wrapped's two calls (Backend, thread f833c285, 4 November 2026):
 * the student's own record, read once, and the Hide from Wrapped switch. A 404
 * on the record is "no Wrapped": none was built for them, or they hid it.
 */
export const wrappedApi = {
  /** The record, or null when there is none (404). */
  me: async (): Promise<WrappedRecord | null> => {
    try {
      const response = await apiClient.get<ApiResponse<WrappedRecord>>('/wrapped/me');
      return response.data.data ?? null;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) return null;
      throw error;
    }
  },

  /**
   * One step of the story, for the view counts (Backend e717a1af). Silent on
   * a 401: a lapsed session must not send the student to sign in mid-story;
   * the caller ignores every failure (lib/wrapped/progress.ts).
   */
  progress: async (step: WrappedProgress): Promise<void> => {
    await apiClient.post('/wrapped/me/progress', step, { headers: { 'X-Silent-Auth': 'true' } });
  },

  /**
   * Wrapped 2026's record (Backend, 21 November 2026), or null on a 404: no
   * record, hidden, or outside the window (one message for all three, so
   * the dates never leak). Staff get theirs as soon as the batch has run.
   */
  me2026: async (): Promise<Wrapped26Record | null> => {
    try {
      const response = await apiClient.get<ApiResponse<Wrapped26Record>>('/wrapped/2026/me');
      return response.data.data ?? null;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 404) return null;
      throw error;
    }
  },

  /** One step of the 2026 story, for the view counts. Silent on a 401, like `progress`. */
  progress2026: async (step: Wrapped26Progress): Promise<void> => {
    await apiClient.post('/wrapped/2026/me/progress', step, { headers: { 'X-Silent-Auth': 'true' } });
  },

  /** Whether Wrapped 2026 is open to everyone, from the server's settings (public). */
  window2026: (): Promise<Wrapped26Window | null> => fetchWrapped26Window(),

  /** Hides every edition (the 2026 one too). */
  setHidden: async (hidden: boolean): Promise<void> => {
    await apiClient.put('/wrapped/me/visibility', { hidden });
  },
};
