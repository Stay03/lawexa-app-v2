import type { AgentConversation } from '@/types/agent-conversations';
import type { BackgroundJob } from '@/types/background-jobs';
import { plainPreview } from '../../plain-preview';

/**
 * agent roster — the pure rules of the agents' rows in a chat (C1, Stay, 12
 * November 2026, 17:47Z; sub-agents contract, sections 2.4, 3 and 4). Each
 * agent Lawexa messaged in a turn is a row after that turn's answer: its
 * initials, its name, its state, and Stop on the right while it works. Its
 * words stream under its name while it writes; once it has replied, the
 * start of the reply stays with "Read the reply".
 *
 * A row joins two reads: the agent's background job (the state, the same for
 * every reader after a reload) and the chat's list of agent conversations
 * (the turn to stream, the reply's start, and whether this reader may stop
 * it, `can_send`: the server's rule, never a check here).
 */

/** Where an agent is, as its row shows it. */
export type AgentRowState = 'writing' | 'replied' | 'stopped' | 'failed' | 'unfollowed';

/**
 * The agent's state from its job. A failed job says why (`failure`, Backend
 * 12 November 2026): `stopped` is a person's Stop, every other reason is "could
 * not reply". With no reason the row never guesses Stopped. A cancelled job
 * is an older "Stop waiting": the chat stopped following, the agent went on.
 */
export function agentRowState(job: Pick<BackgroundJob, 'status' | 'failure'>): AgentRowState {
  switch (job.status) {
    case 'running':
      return 'writing';
    case 'succeeded':
      return 'replied';
    case 'cancelled':
      return 'unfollowed';
    default:
      return job.failure === 'stopped' ? 'stopped' : 'failed';
  }
}

/** The state's words beside the agent's name (the C1 pictures, agreed with the techlead). */
export const AGENT_ROW_WORDS: Readonly<Record<AgentRowState, string>> = {
  writing: 'Writing',
  replied: 'Replied',
  stopped: 'Stopped',
  failed: 'Couldn’t reply. Lawexa carried on without it',
  unfollowed: 'Lawexa stopped waiting for it',
};

/** "Issue Spotter" reads "IS", "Expert" "EX", "a fresh Lawexa" "FL". */
export function agentInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  // Lower-case lead words ("a fresh Lawexa") are skipped when a capitalised one follows.
  const named = words.filter((word) => word.charAt(0) !== word.charAt(0).toLowerCase());
  const pick = named.length > 0 ? named : words;
  if (pick.length === 0) return '?';
  if (pick.length === 1) return pick[0].slice(0, 2).toUpperCase();
  return (pick[0].charAt(0) + pick[1].charAt(0)).toUpperCase();
}

/** One agent's row. */
export interface AgentRow {
  jobId: string;
  /** The agent conversation's uuid: what "Read the reply" and "Open its conversation" open. */
  conversationId: string;
  name: string;
  state: AgentRowState;
  /** The turn to stream while it writes; null until the list names it, and once it ends. */
  executionId: string | null;
  /** Whether this reader may stop the turn (`can_send`, contract 2.4). */
  canStop: boolean;
  /** The start of the reply, as plain words, once it replied; null until the list has it. */
  replyStart: string | null;
}

/**
 * The rows for one question's jobs, in the jobs' order: only the jobs that
 * wait on another agent. The list of agent conversations may be unread or
 * older than the jobs; a row then shows its state alone until it is read.
 */
export function agentRows(
  jobs: readonly BackgroundJob[],
  conversations: readonly AgentConversation[] | undefined,
): AgentRow[] {
  const byId = new Map((conversations ?? []).map((each) => [each.id, each]));
  const rows: AgentRow[] = [];
  for (const job of jobs) {
    if (job.kind !== 'agent_reply' || !job.agent_conversation) continue;
    const entry = byId.get(job.agent_conversation.id);
    const state = agentRowState(job);
    // A turn is streamed only while both reads say it runs: the job's word
    // decides the state, the list's the turn.
    const executionId = state === 'writing' && entry?.status === 'running' ? entry.execution_id : null;
    const preview = state === 'replied' ? (entry?.last_reply?.preview ?? null) : null;
    rows.push({
      jobId: job.id,
      conversationId: job.agent_conversation.id,
      name: entry?.agent.name ?? job.agent_conversation.agent.name,
      state,
      executionId,
      canStop: executionId !== null && entry?.can_send === true,
      replyStart: preview ? plainPreview(preview) || preview : null,
    });
  }
  return rows;
}

/**
 * Whether the list of agent conversations is behind the jobs: a job runs that
 * the list does not show running yet (the list was read before its turn
 * began). The roster then reads the list again once.
 */
export function rosterNeedsList(rows: readonly AgentRow[]): boolean {
  return rows.some((row) => row.state === 'writing' && row.executionId === null);
}
