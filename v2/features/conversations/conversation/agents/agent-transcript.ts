import type { ApiMessage } from '@/types/chat';
import { withoutAttachmentMarks } from '../rows/attachment-markers';

/**
 * agent-transcript — an agent conversation's messages as the side panel
 * draws them (sub-agents contract, section 3.2, "How to read the rows"):
 *
 *   call     a user row with `metadata.type = agent_message`: the calling
 *            agent's message, drawn as "From Expert"
 *   person   a user row with no type: a person typed it, drawn as their bubble
 *   steps    the agent's tool calls in a row, as one quiet list of steps
 *   answer   the agent's answer (an assistant row with no type)
 *   reply    the agent's own sub-agent came back (a wake naming an
 *            `agent_reply` job): who, whether it replied, the start of its
 *            reply, and its conversation to open (depth 2, 24 Nov 2026)
 *   note     a line about the conversation: other background work ending,
 *            or a turn that failed
 *
 * Tool results are left out: their call carries the step. Pure, so a test
 * pins it.
 */

export interface AgentStepCall {
  name: string;
  parameters: Record<string, unknown>;
  success: boolean | undefined;
}

export type AgentTranscriptRow =
  | { kind: 'call'; key: string; from: string; text: string; at: string }
  | { kind: 'person'; key: string; author: string | null; text: string; at: string }
  | { kind: 'steps'; key: string; calls: AgentStepCall[] }
  | { kind: 'answer'; key: string; text: string; at: string }
  | {
      kind: 'reply';
      key: string;
      /** The wake message the reply came in; the turn it wakes starts here. */
      messageId: number;
      agentName: string;
      outcome: SubAgentOutcome;
      preview: string | null;
      /** The reply message, to tell whether the roster above already shows it; null when there was no reply. */
      replyMessageId: number | null;
      conversationId: string;
      at: string;
    }
  | { kind: 'note'; key: string; text: string; at: string; wake?: { messageId: number } };

/** How a sub-agent came back: it replied, it could not, or a person stopped it. */
export type SubAgentOutcome = 'replied' | 'failed' | 'stopped';

export function agentTranscriptRows(messages: readonly ApiMessage[]): AgentTranscriptRow[] {
  const rows: AgentTranscriptRow[] = [];
  for (const message of messages) {
    const type = message.metadata?.type;
    const key = String(message.id);
    const at = message.created_at;
    if (message.role === 'tool' || type === 'tool_call' || type === 'tool_result') {
      if (type !== 'tool_call') continue;
      const call: AgentStepCall = {
        name: message.metadata?.tool_name ?? 'step',
        parameters: message.metadata?.tool_parameters ?? {},
        success: message.metadata?.success,
      };
      const last = rows[rows.length - 1];
      if (last?.kind === 'steps') last.calls.push(call);
      else rows.push({ kind: 'steps', key, calls: [call] });
      continue;
    }
    if (message.role === 'user' && type === 'agent_message') {
      rows.push({ kind: 'call', key, from: message.metadata?.from_agent?.name ?? 'Lawexa', text: shown(message), at });
      continue;
    }
    if (message.role === 'user' && !type) {
      rows.push({ kind: 'person', key, author: message.author?.name ?? null, text: shown(message), at });
      continue;
    }
    if (type === 'background_job_result') {
      // The agent's own sub-agents coming back, each named; any other background work, as one line.
      const jobs = message.metadata?.background_jobs ?? [];
      let others = false;
      for (const job of jobs) {
        const reply = job.kind === 'agent_reply' ? job.agent_reply : undefined;
        if (job.kind !== 'agent_reply') {
          others = true;
          continue;
        }
        // A partial entry (no agent, no conversation) has nothing to name or open: it is left out.
        if (!reply?.agent?.name || !reply.agent_conversation_id) continue;
        const outcome = subAgentOutcome(job);
        rows.push({
          kind: 'reply',
          key: `${key}:${job.job_id}`,
          messageId: message.id,
          agentName: reply.agent.name,
          outcome,
          preview: outcome === 'replied' ? reply.preview : null,
          replyMessageId: outcome === 'replied' ? reply.reply_message_id : null,
          conversationId: reply.agent_conversation_id,
          at,
        });
      }
      if (others || jobs.length === 0) {
        rows.push({ kind: 'note', key: `${key}:other`, text: 'Background work this agent started has ended.', at, wake: { messageId: message.id } });
      }
      continue;
    }
    if (type === 'error') {
      rows.push({ kind: 'note', key, text: message.content || 'This turn did not finish.', at });
      continue;
    }
    if (message.role === 'assistant' && (!type || type === 'narration') && message.content.trim()) {
      rows.push({ kind: 'answer', key, text: message.content, at });
    }
  }
  return rows;
}

/**
 * Where the panel draws the agent's own sub-agents (depth 2): at the end of
 * the turn that called them, as the chat does for Lawexa's agents. A turn
 * starts at a call or a person's message, and the sub-agents' return (a reply
 * row, or the wake note) starts the next part, so the rows go just before it.
 * Keyed by the row index they follow; the value is the turn's first message
 * id, the one the server names as `called_by_message_id`.
 */
export function subAgentPlaces(rows: readonly AgentTranscriptRow[]): ReadonlyMap<number, number> {
  const places = new Map<number, number>();
  let turn: number | null = null;
  const close = (index: number) => {
    if (turn !== null && index >= 0) places.set(index, turn);
    turn = null;
  };
  rows.forEach((row, index) => {
    if (row.kind === 'call' || row.kind === 'person') {
      close(index - 1);
      turn = Number(row.key);
      return;
    }
    // The return wakes the agent for a new turn, which can call an agent too: the
    // server names the wake's id as that call's (as the chat does, turnEndPlaces).
    const wake = row.kind === 'reply' ? row.messageId : row.kind === 'note' && row.wake ? row.wake.messageId : null;
    if (wake !== null && wake !== turn) {
      close(index - 1);
      turn = wake;
    }
  });
  close(rows.length - 1);
  return places;
}

/** A job's outcome as the panel says it: "cancelled", or a failure the server names as a person's Stop, is "stopped". */
function subAgentOutcome(job: { outcome: string; failure?: string | null }): SubAgentOutcome {
  if (job.outcome === 'succeeded') return 'replied';
  return job.outcome === 'cancelled' || job.failure === 'stopped' ? 'stopped' : 'failed';
}

/** The words for a sub-agent's return. */
export const SUB_AGENT_OUTCOME_WORDS: Record<SubAgentOutcome, string> = {
  replied: 'replied',
  failed: 'could not reply',
  stopped: 'was stopped',
};

/**
 * What the reply line shows: who and how it came back, the start of the reply
 * only when the roster above is not already showing that same reply (matched
 * on the reply message, so a second call to the same agent keeps the first
 * line's start), and the conversation to open.
 */
export function subAgentReplyView(
  row: Extract<AgentTranscriptRow, { kind: 'reply' }>,
  shownAbove: ReadonlySet<number>,
): { heading: string; outcome: SubAgentOutcome; preview: string | null; openId: string } {
  const repeated = row.replyMessageId !== null && shownAbove.has(row.replyMessageId);
  return {
    heading: `${row.agentName} ${SUB_AGENT_OUTCOME_WORDS[row.outcome]}`,
    outcome: row.outcome,
    preview: repeated ? null : row.preview,
    openId: row.conversationId,
  };
}

/** A turn's words as shown, without the marks the server writes for its files. */
function shown(message: ApiMessage): string {
  return withoutAttachmentMarks(message.content, (message.attachments?.length ?? 0) > 0);
}

/** The conversation's title without the agent's name the server puts first ("Issue Spotter: Spot the issues…"). */
export function agentConversationTopic(title: string, agentName: string | null): string {
  const prefix = agentName ? `${agentName}: ` : null;
  return prefix && title.startsWith(prefix) ? title.slice(prefix.length) : title;
}
