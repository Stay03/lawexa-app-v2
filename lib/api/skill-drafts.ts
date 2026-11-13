import { apiClient } from './client';
import type { SkillDraftResponse } from '@/types/skill-draft';

/**
 * The person's skill drafts (the skills tool, thread 2b436b4f): the draft a
 * chat's card names, and the two answers to it. Only the person who drafted
 * it gets a 200; anyone else gets 404. Save and Not now answer 422 with
 * `errors.draft[0]` when the draft is no longer waiting for them, or they are
 * no longer a researcher.
 */
export const skillDraftsApi = {
  /** The whole draft: its instructions, and for a change the live skill beside it. */
  get: async (uuid: string): Promise<SkillDraftResponse> => {
    const response = await apiClient.get<SkillDraftResponse>(`/skill-drafts/${uuid}`);
    return response.data;
  },

  /** Send it to an admin for approval ("Sent to an admin for approval."). */
  save: async (uuid: string): Promise<SkillDraftResponse> => {
    const response = await apiClient.post<SkillDraftResponse>(`/skill-drafts/${uuid}/save`);
    return response.data;
  },

  /** Set it aside (Not now). */
  dismiss: async (uuid: string): Promise<SkillDraftResponse> => {
    const response = await apiClient.post<SkillDraftResponse>(`/skill-drafts/${uuid}/dismiss`);
    return response.data;
  },
};
