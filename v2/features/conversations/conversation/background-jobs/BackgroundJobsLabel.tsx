'use client';

import { Ban, Check, CircleAlert, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { BackgroundJob } from '@/types/background-jobs';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  backgroundJobLabel,
  backgroundJobProgress,
  backgroundJobState,
  canCancelBackgroundJob,
  type BackgroundJobState,
} from './model';
import { useBackgroundJobsOf } from './context';

/**
 * BackgroundJobsLabel — under the message whose turn started background work,
 * one quiet line per job (Backend's shapes 063d9cc3, section 1): "Running in
 * the background: file reading · 3 / 10 pages", then "File reading finished.
 * Lawexa will reply shortly." until Lawexa comes back, then Done, Failed or
 * Cancelled. Cancel sits on the line while it can still do something.
 *
 * Nothing at all under a message that started no job, so a chat with no
 * background work looks exactly as before.
 */
export function BackgroundJobsLabel({ messageId }: { messageId: number | null }) {
  const held = useBackgroundJobsOf(messageId);
  if (!held) return null;
  return (
    <ul aria-live="polite" className="mt-1.5 flex flex-col items-end gap-1 px-4">
      {held.jobs.map((job) => (
        <JobLine
          key={job.id}
          job={job}
          cancelling={held.cancellingId === job.id}
          onCancel={() => held.cancel(job.id)}
        />
      ))}
    </ul>
  );
}

const STATE_ICON: Record<BackgroundJobState, typeof Check> = {
  running: Loader2,
  replying: Loader2,
  done: Check,
  failed: CircleAlert,
  unanswered: CircleAlert,
  cancelled: Ban,
};

function JobLine({ job, cancelling, onCancel }: { job: BackgroundJob; cancelling: boolean; onCancel: () => void }) {
  const state = backgroundJobState(job);
  const Icon = STATE_ICON[state];
  const progress = state === 'running' ? backgroundJobProgress(job) : null;
  const spinning = state === 'running' || state === 'replying';
  return (
    // Wraps on a narrow screen rather than cutting the words: on a phone the
    // running line read "file r…" (fixture pictures, 11 November 2026).
    <li className="flex max-w-full flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-right text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <Icon
        aria-hidden
        className={cn('size-3.5 shrink-0', spinning && 'motion-safe:animate-spin', state === 'done' && 'text-primary')}
      />
      <span className="min-w-0">{backgroundJobLabel(job)}</span>
      {progress ? <span className="shrink-0 tabular-nums">· {progress}</span> : null}
      {canCancelBackgroundJob(job) ? (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className={cn(
            'v2-interactive ml-1 shrink-0 rounded-sm font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60',
            FOCUS_RING,
          )}
        >
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      ) : null}
    </li>
  );
}
