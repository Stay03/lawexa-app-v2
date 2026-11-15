import { apiClient } from './client';

/**
 * `GET /chat/attachment-rules`: the files each chat mode takes, keyed normal,
 * redacted and confidential (Backend's ChatAttachmentRules, 76df483f). The
 * shape is read by `readAttachmentRules`, so `data` stays unknown here.
 */
export interface ChatAttachmentRulesResponse {
  success: boolean;
  message?: string;
  data: unknown;
}

export const chatAttachmentRulesApi = {
  get: async (): Promise<ChatAttachmentRulesResponse> => {
    const response = await apiClient.get<ChatAttachmentRulesResponse>('/chat/attachment-rules');
    return response.data;
  },
};
