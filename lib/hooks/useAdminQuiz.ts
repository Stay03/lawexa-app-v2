'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminQuizApi } from '@/lib/api/admin-quiz';
import type {
  AdminQuizQuestionListParams,
  AdminQuizBulkData,
  UpdateAdminQuizQuestionData,
  AdminQuizBatchListParams,
  AdminQuizPeriodParams,
} from '@/types/admin-quiz';

// Query key factory
export const adminQuizKeys = {
  all: ['admin', 'quiz'] as const,
  questions: () => [...adminQuizKeys.all, 'questions'] as const,
  questionList: (params: AdminQuizQuestionListParams) =>
    [...adminQuizKeys.questions(), 'list', params] as const,
  question: (uuid: string) => [...adminQuizKeys.all, 'question', uuid] as const,
  batches: () => [...adminQuizKeys.all, 'batches'] as const,
  batchList: (params: AdminQuizBatchListParams) =>
    [...adminQuizKeys.batches(), 'list', params] as const,
  batchSummary: (params: AdminQuizPeriodParams) =>
    [...adminQuizKeys.batches(), 'summary', params] as const,
  batch: (uuid: string) => [...adminQuizKeys.all, 'batch', uuid] as const,
  analytics: (params: AdminQuizPeriodParams) =>
    [...adminQuizKeys.all, 'analytics', params] as const,
  matchingHealth: (params: AdminQuizPeriodParams) =>
    [...adminQuizKeys.all, 'matching-health', params] as const,
  userQuizProfile: (uuid: string) =>
    [...adminQuizKeys.all, 'user-profile', uuid] as const,
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

/** Soft-delete a question (optionally with a moderation note). */
export function useDeleteAdminQuizQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, moderation_notes }: ModerationVars) =>
      adminQuizApi.deleteQuestion(uuid, { moderation_notes }),
    onSuccess: (_response, { uuid }) => {
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

// ---- Generation observability ----

/** Paginated, filterable list of generation batches. */
export function useAdminQuizBatches(params: AdminQuizBatchListParams = {}) {
  return useQuery({
    queryKey: adminQuizKeys.batchList(params),
    queryFn: () => adminQuizApi.listBatches(params),
    staleTime: 60 * 1000,
  });
}

/** One batch + its token breakdown + questions. */
export function useAdminQuizBatch(uuid: string | undefined) {
  return useQuery({
    queryKey: adminQuizKeys.batch(uuid ?? ''),
    queryFn: () => adminQuizApi.getBatch(uuid as string),
    enabled: !!uuid,
    staleTime: 60 * 1000,
  });
}

/** Period-aware generation summary (totals + coverage). */
export function useAdminQuizBatchSummary(params: AdminQuizPeriodParams = {}) {
  return useQuery({
    queryKey: adminQuizKeys.batchSummary(params),
    queryFn: () => adminQuizApi.getBatchSummary(params),
    staleTime: 60 * 1000,
  });
}

// ---- Analytics, matching-health, per-user ----

/** Period-aware usage analytics dashboard. */
export function useAdminQuizAnalytics(params: AdminQuizPeriodParams = {}) {
  return useQuery({
    queryKey: adminQuizKeys.analytics(params),
    queryFn: () => adminQuizApi.getAnalytics(params),
    staleTime: 60 * 1000,
  });
}

/** Period-aware cross-user matching-health monitor. */
export function useAdminQuizMatchingHealth(params: AdminQuizPeriodParams = {}) {
  return useQuery({
    queryKey: adminQuizKeys.matchingHealth(params),
    queryFn: () => adminQuizApi.getMatchingHealth(params),
    staleTime: 60 * 1000,
  });
}

/** One student's quiz profile (admin). Pass `undefined` to disable. */
export function useAdminUserQuizProfile(uuid: string | undefined) {
  return useQuery({
    queryKey: adminQuizKeys.userQuizProfile(uuid ?? ''),
    queryFn: () => adminQuizApi.getUserQuizProfile(uuid as string),
    enabled: !!uuid,
    staleTime: 60 * 1000,
  });
}
