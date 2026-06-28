'use client';

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { quizApi } from '@/lib/api/quiz';
import type {
  QuizSessionListParams,
  StartQuizSessionData,
  SubmitQuizAnswerData,
} from '@/types/quiz';

// Query keys factory
export const quizKeys = {
  all: ['quiz'] as const,
  sessions: () => [...quizKeys.all, 'sessions'] as const,
  sessionList: (params: QuizSessionListParams) =>
    [...quizKeys.sessions(), 'list', params] as const,
  sessionsInfinite: (params: Omit<QuizSessionListParams, 'page'>) =>
    [...quizKeys.sessions(), 'infinite', params] as const,
  session: (uuid: string) => [...quizKeys.all, 'session', uuid] as const,
  results: (uuid: string) => [...quizKeys.all, 'results', uuid] as const,
  topics: () => [...quizKeys.all, 'topics'] as const,
  stats: () => [...quizKeys.all, 'stats'] as const,
};

/**
 * Paginated list of my past quiz sessions.
 */
export function useQuizSessions(params: QuizSessionListParams = {}) {
  return useQuery({
    queryKey: quizKeys.sessionList(params),
    queryFn: () => quizApi.listSessions(params),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Infinite-scroll list of my past quiz sessions (history screen).
 */
export function useInfiniteQuizSessions(
  params: Omit<QuizSessionListParams, 'page'> = {}
) {
  return useInfiniteQuery({
    queryKey: quizKeys.sessionsInfinite(params),
    queryFn: ({ pageParam }) =>
      quizApi.listSessions({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { current_page, last_page } = lastPage.pagination;
      return current_page < last_page ? current_page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Current state + current question for a session. Used to rehydrate the play
 * screen on reload; `staleTime: 0` so we always pull the live current question.
 */
export function useQuizSession(sessionUuid: string | undefined) {
  return useQuery({
    queryKey: quizKeys.session(sessionUuid ?? ''),
    queryFn: () => quizApi.getSession(sessionUuid as string),
    enabled: !!sessionUuid,
    staleTime: 0,
  });
}

/**
 * Results for an ended session (answers revealed). Frozen once finalized, so a
 * longer stale window is fine.
 */
export function useQuizResults(sessionUuid: string | undefined) {
  return useQuery({
    queryKey: quizKeys.results(sessionUuid ?? ''),
    queryFn: () => quizApi.getResults(sessionUuid as string),
    enabled: !!sessionUuid,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Recent topics for the optional picker.
 */
export function useQuizTopics() {
  return useQuery({
    queryKey: quizKeys.topics(),
    queryFn: () => quizApi.getTopics(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * The student's own progress stats (reports view).
 */
export function useQuizStats() {
  return useQuery({
    queryKey: quizKeys.stats(),
    queryFn: () => quizApi.getStats(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Start or resume my session. The returned session + first question drive the
 * play screen directly; we also seed the session cache and refresh the history
 * list.
 */
export function useStartQuizSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StartQuizSessionData = {}) => quizApi.startSession(data),
    onSuccess: (response) => {
      queryClient.setQueryData(
        quizKeys.session(response.data.session.uuid),
        response
      );
      queryClient.invalidateQueries({ queryKey: quizKeys.sessions() });
    },
  });
}

/**
 * Submit an answer for the current question of a session.
 *
 * The response already carries the updated score + the next question, so the
 * play screen renders straight from it. We intentionally do NOT invalidate on
 * every answer (that would refetch the session each step); instead we keep the
 * session-detail cache in sync so a mid-session reload is seamless.
 */
export function useSubmitQuizAnswer(sessionUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubmitQuizAnswerData) =>
      quizApi.submitAnswer(sessionUuid, data),
    onSuccess: (response) => {
      queryClient.setQueryData(quizKeys.session(sessionUuid), response);
    },
  });
}

/**
 * End a session. Refreshes the history list (status/score changed), drops the
 * stale current-question cache, and clears any results cache so the review
 * screen fetches the finalized data.
 */
export function useEndQuizSession(sessionUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => quizApi.endSession(sessionUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: quizKeys.session(sessionUuid) });
      queryClient.invalidateQueries({ queryKey: quizKeys.results(sessionUuid) });
    },
  });
}
