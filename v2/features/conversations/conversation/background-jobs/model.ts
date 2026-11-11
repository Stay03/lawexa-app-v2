import type { BackgroundJob, BackgroundJobKind, BackgroundJobOutcome } from '@/types/background-jobs';

/**
 * background-jobs model — the pure rules of a chat's background jobs
 * (Backend's shapes 063d9cc3, docs/api/background-jobs-shapes.md): what the
 * label under the message that started a job says, when Cancel is offered,
 * when the chat keeps asking, and the words of the line Lawexa's return draws.
 */

/** The kind in plain words, as the list names it (`kind_name`), for a line that carries only the kind. */
const KIND_NAMES: Readonly<Record<BackgroundJobKind, string>> = {
  file_transcription: 'file reading',
  case_import: 'case import',
  radar_scan: 'Radar scan',
};

function capitalised(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Where a job is, as its label shows it. */
export type BackgroundJobState = 'running' | 'replying' | 'done' | 'failed' | 'cancelled' | 'unanswered';

/**
 * The job's state for its label. An ended job Lawexa has not answered yet
 * (`wake: pending`) is `replying`, whatever its outcome: what matters to the
 * reader is that the answer is on its way. One Lawexa could not come back to
 * (`wake: abandoned`) is `unanswered`, and the give-up line says the rest.
 */
export function backgroundJobState(job: Pick<BackgroundJob, 'status' | 'wake'>): BackgroundJobState {
  if (job.status === 'running') return 'running';
  if (job.status === 'cancelled') return 'cancelled';
  if (job.wake === 'pending') return 'replying';
  if (job.wake === 'abandoned') return 'unanswered';
  return job.status === 'failed' ? 'failed' : 'done';
}

/** "3 / 10 pages", "3 pages" when the total is unknown; null with no progress to show. */
export function backgroundJobProgress(job: Pick<BackgroundJob, 'progress'>): string | null {
  const progress = job.progress;
  if (!progress) return null;
  return progress.total === null
    ? `${progress.done} ${progress.unit}`
    : `${progress.done} / ${progress.total} ${progress.unit}`;
}

/** The label's words, by state (Backend's doc, section 1). */
export function backgroundJobLabel(job: Pick<BackgroundJob, 'status' | 'wake' | 'kind_name'>): string {
  const kind = capitalised(job.kind_name);
  switch (backgroundJobState(job)) {
    case 'running':
      return `Running in the background: ${job.kind_name}`;
    case 'replying':
      return `${kind} ${job.status === 'failed' ? 'failed' : 'finished'}. Lawexa will reply shortly.`;
    case 'cancelled':
      return `${kind} cancelled`;
    case 'failed':
      return `${kind} failed`;
    case 'unanswered':
      return `${kind} ${job.status === 'failed' ? 'failed' : 'finished'}`;
    default:
      return `${kind} done`;
  }
}

/** Cancel is offered while it can still do something: the job runs, or Lawexa has not answered it yet. */
export function canCancelBackgroundJob(job: Pick<BackgroundJob, 'status' | 'wake'>): boolean {
  return job.status === 'running' || (job.status !== 'cancelled' && job.wake === 'pending');
}

/**
 * Whether the chat is still waiting on a job: one runs, or one ended and
 * Lawexa has not come back to it. While it is, the chat keeps reading its
 * jobs and its status, so the return streams in on screen.
 */
export function awaitsBackgroundJob(jobs: readonly Pick<BackgroundJob, 'status' | 'wake'>[]): boolean {
  return jobs.some((job) => job.status === 'running' || (job.status !== 'cancelled' && job.wake === 'pending'));
}

/** The jobs by the message whose turn started them, in the list's order. */
export function backgroundJobsByMessage(jobs: readonly BackgroundJob[]): ReadonlyMap<number, readonly BackgroundJob[]> {
  const byMessage = new Map<number, BackgroundJob[]>();
  for (const job of jobs) {
    if (job.started_by_message_id === null) continue;
    const held = byMessage.get(job.started_by_message_id);
    if (held) held.push(job);
    else byMessage.set(job.started_by_message_id, [job]);
  }
  return byMessage;
}

/**
 * The line drawn for Lawexa's return (`background_job_result`): built from
 * the jobs the message names, never from its `content`, which is written for
 * Lawexa (Backend's doc, section 3). "File reading finished. Lawexa is
 * continuing." for one job; "2 background jobs ended. Lawexa is continuing."
 * for several.
 */
export function backgroundReturnLine(outcomes: readonly Pick<BackgroundJobOutcome, 'kind' | 'outcome'>[]): string {
  if (outcomes.length === 1) {
    const [only] = outcomes;
    const kind = capitalised(KIND_NAMES[only.kind] ?? 'background job');
    return `${kind} ${only.outcome === 'failed' ? 'failed' : 'finished'}. Lawexa is continuing.`;
  }
  if (outcomes.length === 0) return 'Background work ended. Lawexa is continuing.';
  return `${outcomes.length} background jobs ended. Lawexa is continuing.`;
}
