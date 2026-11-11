'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { backgroundJobsApi } from '@/lib/api/background-jobs';
import type { BackgroundJob, BackgroundJobListResponse } from '@/types/background-jobs';
import { conversationsQueries } from '../../queries';

/** The job as the server now holds it, written over its row in every read of the chat's jobs. */
function landJob(queryClient: QueryClient, conversationId: string, job: BackgroundJob): void {
  queryClient.setQueriesData<BackgroundJobListResponse>(
    { queryKey: conversationsQueries.backgroundJobsOf(conversationId) },
    (data) =>
      data
        ? {
            ...data,
            data: { background_jobs: data.data.background_jobs.map((row) => (row.id === job.id ? job : row)) },
          }
        : data,
  );
}

/** The job a `422` names (`errors.background_job`): nothing was left to cancel, and this is why. */
function refusedJob(error: unknown): BackgroundJob | null {
  if (!isAxiosError(error) || error.response?.status !== 422) return null;
  const job = (error.response.data as { errors?: { background_job?: BackgroundJob } } | undefined)?.errors
    ?.background_job;
  return job && typeof job.id === 'string' ? job : null;
}

/**
 * Cancel a background job (`POST /background-jobs/{uuid}/cancel`; Backend's
 * shapes 063d9cc3): a running one, or one Lawexa has not answered yet, which
 * Lawexa is then not woken with. The work itself may still finish; the
 * label says Cancelled either way.
 *
 * A `422` is not a failure to show: the job had already ended and been
 * answered, or was cancelled already, and the refusal carries the job as it
 * is, which lands in the label at once. Anything else re-reads the list.
 */
export function useCancelBackgroundJob(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobUuid: string) => backgroundJobsApi.cancel(jobUuid),
    meta: { silentError: true },
    onSuccess: (response) => landJob(queryClient, conversationId, response.data.background_job),
    onError: (error) => {
      const job = refusedJob(error);
      if (job) {
        landJob(queryClient, conversationId, job);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: conversationsQueries.backgroundJobsOf(conversationId) });
    },
  });
}
