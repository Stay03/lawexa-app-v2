import { apiClient } from './client';
import type { RedactionCategory, RedactionDefaultResponse } from '@/types/redaction';

/**
 * The person's saved choice of what a new redacted chat hides (Backend's
 * 62fd6f65, thread cce2eafe). A new user hides all five. Saving needs at least
 * one choice and no repeats, else 422.
 */
export const redactionDefaultApi = {
  get: async (): Promise<RedactionDefaultResponse> => {
    const response = await apiClient.get<RedactionDefaultResponse>('/users/redaction-default');
    return response.data;
  },

  save: async (categories: RedactionCategory[]): Promise<RedactionDefaultResponse> => {
    const response = await apiClient.put<RedactionDefaultResponse>('/users/redaction-default', { categories });
    return response.data;
  },
};
