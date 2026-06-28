'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminQuizApi } from '@/lib/api/admin-quiz';
import type {
  AdminQuizQuestionListParams,
  AdminQuizBulkData,
  UpdateAdminQuizQuestionData,
} from '@/types/admin-quiz';

// Query key factory
export const adminQuizKeys = {
  all: ['admin', 'quiz'] as const,
  questions: () => [...adminQuizKeys.all, 'questions'] as const,
  questionList: (params: AdminQuizQuestionListParams) =>
    [...adminQuizKeys.questions(), 'list', params] as const,
  question: (uuid: string) => [...adminQuizKeys.all, 'question', uuid] as const,
};

/** Paginated, filterable list of bank questions. */
export function useAdminQuizQuestions(params: AdminQuizQuestionListParams = {}) {
  return useQuery({
    queryKey: adminQuizKeys.questionList(params),
    queryFn: () => adminQuizApi.listQuestions(params),
    staleTime: 60 * 1000,
  });
}

/** Full detail for one question. */
export function useAdminQuizQuestion(uuid: string | undefined) {
  return useQuery({
    queryKey: adminQuizKeys.question(uuid ?? ''),
    queryFn: () => adminQuizApi.getQuestion(uuid as string),
    enabled: !!uuid,
    staleTime: 60 * 1000,
  });
}

/** Edit a question (PATCH). */
export function useUpdateAdminQuizQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      uuid,
      data,
    }: {
      uuid: string;
      data: UpdateAdminQuizQuestionData;
    }) => adminQuizApi.updateQuestion(uuid, data),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(adminQuizKeys.question(variables.uuid), response);
      queryClient.invalidateQueries({ queryKey: adminQuizKeys.questions() });
    },
  });
}

interface ModerationVars {
  uuid: string;
  moderation_notes?: string;
}

/** Approve a question (→ approved). */
export function useApproveAdminQuizQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, moderation_notes }: ModerationVars) =>
      adminQuizApi.approveQuestion(uuid, { moderation_notes }),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(adminQuizKeys.question(variables.uuid), response);
      queryClient.invalidateQueries({ queryKey: adminQuizKeys.questions() });
    },
  });
}

/** Archive a question (→ archived, hidden from quizzes). */
export function useArchiveAdminQuizQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, moderation_notes }: ModerationVars) =>
      adminQuizApi.archiveQuestion(uuid, { moderation_notes }),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(adminQuizKeys.question(variables.uuid), response);
      queryClient.invalidateQueries({ queryKey: adminQuizKeys.questions() });
    },
  });
}

/** Restore a soft-deleted question. */
export function useRestoreAdminQuizQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, moderation_notes }: ModerationVars) =>
      adminQuizApi.restoreQuestion(uuid, { moderation_notes }),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(adminQuizKeys.question(variables.uuid), response);
      queryClient.invalidateQueries({ queryKey: adminQuizKeys.questions() });
    },
  });
}

/** Soft-delete a question. */
export function useDeleteAdminQuizQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => adminQuizApi.deleteQuestion(uuid),
    onSuccess: (_response, uuid) => {
      queryClient.invalidateQueries({ queryKey: adminQuizKeys.question(uuid) });
      queryClient.invalidateQueries({ queryKey: adminQuizKeys.questions() });
    },
  });
}

/** Bulk approve/archive selected questions (by uuid). */
export function useBulkAdminQuizQuestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminQuizBulkData) => adminQuizApi.bulk(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQuizKeys.questions() });
    },
  });
}
