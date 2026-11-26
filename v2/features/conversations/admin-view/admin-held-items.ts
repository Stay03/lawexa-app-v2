import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type { Recording } from '@/types/recording';
import type { SkillDraftResponse } from '@/types/skill-draft';
import { jobOf, type HeldItemsSource } from '../conversation/held-items-source';

/**
 * The admin view's reads of what the chat holds (Backend cd4eaeef): the
 * owner's exact shapes, only for an item this chat holds, recording nothing.
 * A Space or confidential chat answers 404, as the rest of the admin view.
 */
export function adminHeldItems(conversationId: string): HeldItemsSource {
  const base = `/admin/conversations/${encodeURIComponent(conversationId)}`;
  return {
    quizJob: async (uuid) => jobOf((await apiClient.get<{ data?: { job?: unknown } }>(`${base}/quiz-jobs/${encodeURIComponent(uuid)}`)).data),
    recording: async (uuid) => (await apiClient.get<ApiResponse<Recording>>(`${base}/recordings/${encodeURIComponent(uuid)}`)).data,
    skillDraft: async (uuid) => (await apiClient.get<SkillDraftResponse>(`${base}/skill-drafts/${encodeURIComponent(uuid)}`)).data,
  };
}
