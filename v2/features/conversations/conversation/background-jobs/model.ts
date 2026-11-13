import type { BackgroundJob, BackgroundJobKind, BackgroundJobOutcome } from '@/types/background-jobs';
import type { ToolResult } from '@/types/chat';

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
  agent_reply: 'message to another agent',
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

/**
 * A running reading that stopped moving and is waiting to be picked up again
 * (Backend's stall fix ca11f4c8: `waiting_to_resume`). The line says so in
 * place of a count that stands still; an older server sends no field, which
 * reads as not waiting, so the line is as before.
 */
export function waitingToResume(job: Pick<BackgroundJob, 'status' | 'waiting_to_resume'>): boolean {
  return job.status === 'running' && job.waiting_to_resume === true;
}

/** "3 / 10 pages", "3 pages" when the total is unknown; null with no progress to show, or while it waits to restart. */
export function backgroundJobProgress(job: Pick<BackgroundJob, 'progress' | 'status' | 'waiting_to_resume'>): string | null {
  const progress = job.progress;
  if (!progress || waitingToResume(job)) return null;
  return progress.total === null
    ? `${progress.done} ${progress.unit}`
    : `${progress.done} / ${progress.total} ${progress.unit}`;
}

/**
 * The label's words, by state (Backend's doc, section 1). A job that waits on
 * another agent has no label: it is that agent's row (agents/agent-roster.ts).
 */
export function backgroundJobLabel(job: Pick<BackgroundJob, 'status' | 'wake' | 'kind_name' | 'waiting_to_resume'>): string {
  const kind = capitalised(job.kind_name);
  switch (backgroundJobState(job)) {
    case 'running':
      return waitingToResume(job) ? 'Reading paused · restarting automatically' : `Running in the background: ${job.kind_name}`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether a tool's answer started a background job, or handed its work to one
 * already running. The server's answer carries the job as
 * `data.background_job` (BackgroundJobRegistry::toolPayload: read_file's 202
 * on a file still being read, message_agent's send), and the stream's
 * `tool_complete` passes that whole answer on as `tool_result.data`. Read on
 * that event, the chat asks for its jobs at once, so a job that runs only
 * seconds shows its line while the turn is still writing (Lucy's check 2,
 * 13 November 2026: a 17-second file reading).
 */
export function toolResultNamesBackgroundJob(result: ToolResult | null | undefined): boolean {
  const answer = result?.data;
  return isRecord(answer) && isRecord(answer.data) && isRecord(answer.data.background_job);
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
export function backgroundReturnLine(
  outcomes: readonly (Pick<BackgroundJobOutcome, 'kind' | 'outcome'> & Partial<Pick<BackgroundJobOutcome, 'agent_reply'>>)[],
): string {
  if (outcomes.length === 1) {
    const [only] = outcomes;
    // One agent's reply: named, as its preview row under the line names it (sub-agents contract, section 4).
    if (only.kind === 'agent_reply' && only.agent_reply) {
      return `${only.agent_reply.agent.name} ${only.outcome === 'failed' ? 'could not reply' : 'replied'}. Lawexa is continuing.`;
    }
    const kind = capitalised(KIND_NAMES[only.kind] ?? 'background job');
    return `${kind} ${only.outcome === 'failed' ? 'failed' : 'finished'}. Lawexa is continuing.`;
  }
  if (outcomes.length === 0) return 'Background work ended. Lawexa is continuing.';
  return `${outcomes.length} background jobs ended. Lawexa is continuing.`;
}
