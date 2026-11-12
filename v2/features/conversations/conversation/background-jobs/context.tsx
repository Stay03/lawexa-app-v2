'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { BackgroundJob } from '@/types/background-jobs';
import { backgroundJobsByMessage } from './model';
import { useCancelBackgroundJob } from './mutations';

interface BackgroundJobsValue {
  /** The chat the jobs belong to: the agents' rows read its agent conversations. */
  conversationId: string;
  byMessage: ReadonlyMap<number, readonly BackgroundJob[]>;
  cancel: (jobUuid: string) => void;
  /** The jobs whose cancel is on its way, whose buttons show the wait. */
  cancelling: ReadonlySet<string>;
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
  const { mutate } = useCancelBackgroundJob(conversationId);
  // Every cancel on its way, by job: one shared mutation reports only its
  // latest call, so a second press would have re-enabled the first button
  // while its request was still out (review of 8d263fb2).
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(() => new Set());
  const cancel = useCallback(
    (jobUuid: string) => {
      setCancelling((held) => new Set(held).add(jobUuid));
      mutate(jobUuid, {
        onSettled: () =>
          setCancelling((held) => {
            const next = new Set(held);
            next.delete(jobUuid);
            return next;
          }),
      });
    },
    [mutate],
  );
  const value = useMemo<BackgroundJobsValue>(
    () => ({ conversationId, byMessage: backgroundJobsByMessage(jobs), cancel, cancelling }),
    [conversationId, jobs, cancel, cancelling],
  );
  return <BackgroundJobsContext.Provider value={value}>{children}</BackgroundJobsContext.Provider>;
}

/** The jobs a message started, and how to cancel one; nothing outside a chat that provides them. */
export function useBackgroundJobsOf(messageId: number | null): {
  conversationId: string;
  jobs: readonly BackgroundJob[];
  cancel: (jobUuid: string) => void;
  cancelling: ReadonlySet<string>;
} | null {
  const value = useContext(BackgroundJobsContext);
  if (!value || messageId === null) return null;
  const jobs = value.byMessage.get(messageId);
  return jobs ? { conversationId: value.conversationId, jobs, cancel: value.cancel, cancelling: value.cancelling } : null;
}
