'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminChannelQuizzesApi } from '@/lib/api/admin-channel-quizzes';
import type {
  AdminChannelQuizAttemptListParams,
  AdminChannelQuizListParams,
  AdminChannelQuizTotalsParams,
} from '@/types/admin-channel-quizzes';

/** Query keys for the admin Explore quizzes (new) tab, as useAdminQuiz.ts keys the old one. */
export const adminChannelQuizKeys = {
  all: ['admin', 'channel-quizzes'] as const,
  attempts: (params: AdminChannelQuizAttemptListParams) => [...adminChannelQuizKeys.all, 'attempts', 'list', params] as const,
  attempt: (uuid: string) => [...adminChannelQuizKeys.all, 'attempt', uuid] as const,
  quizzes: (params: AdminChannelQuizListParams) => [...adminChannelQuizKeys.all, 'quizzes', 'list', params] as const,
  quiz: (uuid: string) => [...adminChannelQuizKeys.all, 'quiz', uuid] as const,
  totals: (params: AdminChannelQuizTotalsParams) => [...adminChannelQuizKeys.all, 'totals', params] as const,
  userAttempts: (uuid: string, params: AdminChannelQuizAttemptListParams) =>
    [...adminChannelQuizKeys.all, 'user', uuid, params] as const,
};

const STALE_MS = 60 * 1000;

/** Every play, newest first, filtered. The last page stays on screen while the next one loads. */
export function useAdminChannelQuizAttempts(params: AdminChannelQuizAttemptListParams) {
  return useQuery({
    queryKey: adminChannelQuizKeys.attempts(params),
    queryFn: () => adminChannelQuizzesApi.listAttempts(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

/** One play, question by question. */
export function useAdminChannelQuizAttempt(uuid: string | undefined) {
  return useQuery({
    queryKey: adminChannelQuizKeys.attempt(uuid ?? ''),
    queryFn: () => adminChannelQuizzesApi.getAttempt(uuid as string),
    enabled: !!uuid,
    staleTime: STALE_MS,
  });
}

/** Every quiz with its play numbers. */
export function useAdminChannelQuizzes(params: AdminChannelQuizListParams) {
  return useQuery({
    queryKey: adminChannelQuizKeys.quizzes(params),
    queryFn: () => adminChannelQuizzesApi.listQuizzes(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

/** One quiz and its questions' numbers. */
export function useAdminChannelQuiz(uuid: string | undefined) {
  return useQuery({
    queryKey: adminChannelQuizKeys.quiz(uuid ?? ''),
    queryFn: () => adminChannelQuizzesApi.getQuiz(uuid as string),
    enabled: !!uuid,
    staleTime: STALE_MS,
  });
}

/** Totals over a date range (the last 30 days by default, the server's). */
export function useAdminChannelQuizTotals(params: AdminChannelQuizTotalsParams) {
  return useQuery({
    queryKey: adminChannelQuizKeys.totals(params),
    queryFn: () => adminChannelQuizzesApi.getTotals(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}

/** One person's plays and summary. Pass `undefined` to wait for the uuid. */
export function useAdminUserChannelQuizAttempts(uuid: string | undefined, params: AdminChannelQuizAttemptListParams) {
  return useQuery({
    queryKey: adminChannelQuizKeys.userAttempts(uuid ?? '', params),
    queryFn: () => adminChannelQuizzesApi.listUserAttempts(uuid as string, params),
    enabled: !!uuid,
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
}
