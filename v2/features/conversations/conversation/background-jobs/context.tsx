'use client';

import { createContext, useContext, useMemo } from 'react';

import type { BackgroundJob } from '@/types/background-jobs';
import { backgroundJobsByMessage } from './model';
import { useCancelBackgroundJob } from './mutations';

interface BackgroundJobsValue {
  byMessage: ReadonlyMap<number, readonly BackgroundJob[]>;
  cancel: (jobUuid: string) => void;
  /** The job whose cancel is on its way, whose button shows the wait. */
  cancellingId: string | null;
}

const BackgroundJobsContext = createContext<BackgroundJobsValue | null>(null);

/**
 * The open chat's background jobs, for the label under each message that
 * started one (Backend's shapes 063d9cc3). The screen provides them from the
 * controller's read; the rows deep in the transcript find theirs by the
 * message's saved id.
 */
export function BackgroundJobsProvider({
  conversationId,
  jobs,
  children,
}: {
  conversationId: string;
  jobs: readonly BackgroundJob[];
  children: React.ReactNode;
}) {
  const cancelMutation = useCancelBackgroundJob(conversationId);
  const { mutate, isPending, variables } = cancelMutation;
  const value = useMemo<BackgroundJobsValue>(
    () => ({
      byMessage: backgroundJobsByMessage(jobs),
      cancel: (jobUuid) => mutate(jobUuid),
      cancellingId: isPending ? (variables ?? null) : null,
    }),
    [jobs, mutate, isPending, variables],
  );
  return <BackgroundJobsContext.Provider value={value}>{children}</BackgroundJobsContext.Provider>;
}

/** The jobs a message started, and how to cancel one; nothing outside a chat that provides them. */
export function useBackgroundJobsOf(messageId: number | null): {
  jobs: readonly BackgroundJob[];
  cancel: (jobUuid: string) => void;
  cancellingId: string | null;
} | null {
  const value = useContext(BackgroundJobsContext);
  if (!value || messageId === null) return null;
  const jobs = value.byMessage.get(messageId);
  return jobs ? { jobs, cancel: value.cancel, cancellingId: value.cancellingId } : null;
}
