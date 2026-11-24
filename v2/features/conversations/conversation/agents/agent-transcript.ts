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
  | { kind: 'reply'; key: string; agentName: string; failed: boolean; preview: string | null; conversationId: string; at: string }
  | { kind: 'note'; key: string; text: string; at: string; wake?: boolean };

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
      // The agent's own sub-agents coming back, named; any other background work, as one line.
      const replies = (message.metadata?.background_jobs ?? []).filter((job) => job.kind === 'agent_reply' && job.agent_reply);
      for (const job of replies) {
        const reply = job.agent_reply!;
        rows.push({
          kind: 'reply',
          key: `${key}:${job.job_id}`,
          agentName: reply.agent.name,
          failed: job.outcome === 'failed',
          preview: job.outcome === 'failed' ? null : reply.preview,
          conversationId: reply.agent_conversation_id,
          at,
        });
      }
      if (replies.length === 0) rows.push({ kind: 'note', key, text: 'Background work this agent started has ended.', at, wake: true });
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
    const startsTurn = row.kind === 'call' || row.kind === 'person';
    const returns = row.kind === 'reply' || (row.kind === 'note' && row.wake === true);
    if (startsTurn || returns) close(index - 1);
    if (startsTurn) turn = Number(row.key);
  });
  close(rows.length - 1);
  return places;
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
