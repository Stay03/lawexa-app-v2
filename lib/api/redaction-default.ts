import { apiClient } from './client';
import type { RedactionDefaultResponse } from '@/types/redaction';

/**
 * The person's current choice of what a new redacted chat hides, and the six
 * options (Backend's 20dce5a2, thread cce2eafe). A new user hides all six.
 *
 * Read only: the app never saves it (Stay's V3, 14 November 2026). The server
 * makes the `redaction_categories` sent with a new redacted chat's first
 * message the person's default when it creates the chat.
 */
export const redactionDefaultApi = {
  get: async (): Promise<RedactionDefaultResponse> => {
    const response = await apiClient.get<RedactionDefaultResponse>('/users/redaction-default');
    return response.data;
  },
};
