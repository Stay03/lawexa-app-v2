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
 *   note     a line about the conversation: the agent's own sub-agent
 *            replying, or a turn that failed
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
  | { kind: 'note'; key: string; text: string; at: string };

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
      rows.push({ kind: 'note', key, text: 'Background work this agent started has ended.', at });
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

/** A turn's words as shown, without the marks the server writes for its files. */
function shown(message: ApiMessage): string {
  return withoutAttachmentMarks(message.content, (message.attachments?.length ?? 0) > 0);
}

/** The conversation's title without the agent's name the server puts first ("Issue Spotter: Spot the issues…"). */
export function agentConversationTopic(title: string, agentName: string | null): string {
  const prefix = agentName ? `${agentName}: ` : null;
  return prefix && title.startsWith(prefix) ? title.slice(prefix.length) : title;
}
