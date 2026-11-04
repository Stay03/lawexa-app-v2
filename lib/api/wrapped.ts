import { AxiosError } from 'axios';

import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { WrappedRecord } from '@/lib/wrapped/types';

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

  setHidden: async (hidden: boolean): Promise<void> => {
    await apiClient.put('/wrapped/me/visibility', { hidden });
  },
};
