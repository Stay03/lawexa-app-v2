'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';
import { statusOf } from '@/v2/runtime/persist/policy';
import { quizJobFinished } from './created-quiz';

/** How often a quiz still being made is asked about: every 4 s. */
export const QUIZ_JOB_POLL_MS = 4_000;

/**
 * A quiz the server is still making, asked about until it is done or failed
 * (backend, 24 October 2026: create_quiz returns at once with a job, because
 * the server ends a request after 30 s). `GET /api/quiz-jobs/{uuid}`, owner
 * only; anyone else gets 404, which ends the asking.
 *
 * The asking stops when the job finishes, when the card leaves the screen (a
 * query with no one watching does not poll), and while the tab is hidden. A
 * reopened chat's stored job asks once and a finished job answers at once.
 */
export function useQuizJob(uuid: string) {
  return useQuery({
    queryKey: ['quiz-job', uuid] as const,
    queryFn: async () => {
      const response = await apiClient.get<{ data?: { job?: unknown } }>(`/quiz-jobs/${encodeURIComponent(uuid)}`);
      return response.data?.data?.job ?? null;
    },
    refetchInterval: (query) =>
      quizJobFinished(query.state.data) || statusOf(query.state.error) === 404 ? false : QUIZ_JOB_POLL_MS,
    refetchIntervalInBackground: false,
    // A finished job never changes; a running one is always asked afresh.
    staleTime: (query) => (quizJobFinished(query.state.data) ? Infinity : 0),
    retry: (failures, error) => statusOf(error) !== 404 && failures < 2,
  });
}
