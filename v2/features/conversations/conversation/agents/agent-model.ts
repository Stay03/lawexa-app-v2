import type { BackgroundJob, BackgroundJobOutcome, AgentReplyOutcome } from '@/types/background-jobs';
import { plainPreview } from '../../plain-preview';

/**
 * agents model — the pure rules of sub-agents in a chat (contract:
 * docs/api/sub-agents-contract.md, sections 3 and 4). Lawexa messages another
 * agent with `message_agent`; the agent answers in an agent conversation of
 * its own, in the background; Lawexa is woken with its reply. The chat shows
 * three states under the person's message:
 *
 *   Writing to Issue Spotter…    the call, while Lawexa's turn streams
 *   Waiting for Issue Spotter…   the background job, until the reply lands
 *   Issue Spotter replied        a preview row in Lawexa's return, "Open full"
 *
 * An agent conversation is named by its agent and opened by its uuid; the
 * model's handle (issue-spotter-1) is never shown.
 */

/** The tool Lawexa messages another agent with. */
export const MESSAGE_AGENT_TOOL = 'message_agent';

/** The slug that means "a fresh copy of yourself". */
const SELF = 'lawexa';

/**
 * An agent's name from the slug Lawexa wrote, before the tool answers with
 * the name itself: "issue-spotter" reads "Issue Spotter", "lawexa" "a fresh
 * Lawexa".
 */
export function agentNameFromSlug(slug: string): string {
  const trimmed = slug.trim();
  if (!trimmed) return 'another agent';
  if (trimmed.toLowerCase() === SELF) return 'a fresh Lawexa';
  return trimmed
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** The agent a `message_agent` result names (`data.agent_conversation.agent.name`), or null. */
export function calledAgentName(result: { data?: unknown } | undefined): string | null {
  const data = result?.data as { agent_conversation?: { agent?: { name?: unknown } } } | undefined;
  const name = data?.agent_conversation?.agent?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

/**
 * The step's words for a `message_agent` call: "Writing to Issue Spotter"
 * while it runs (the agent named from the slug in the call), "Wrote to Issue
 * Spotter" once the tool answers with the agent's own name.
 */
export function messageAgentStep(
  parameters: Record<string, unknown>,
  isComplete: boolean,
  result?: { data?: unknown },
): { action: string; detail?: string } {
  const slug = typeof parameters.agent === 'string' ? parameters.agent : '';
  const name = calledAgentName(result) ?? (slug ? agentNameFromSlug(slug) : 'another agent');
  return { action: isComplete ? `Wrote to ${name}` : `Writing to ${name}` };
}

/** The agent conversation a job follows, when it waits on another agent; null for every other job. */
export function jobAgentConversation(job: Pick<BackgroundJob, 'kind' | 'agent_conversation'>): BackgroundJob['agent_conversation'] {
  return job.kind === 'agent_reply' ? (job.agent_conversation ?? null) : null;
}

/**
 * The status line's words for an agent's job, by the job's state
 * (background-jobs/model.ts): waiting while it runs; replied, or could not
 * reply, once it ends, with "Lawexa will reply shortly" until Lawexa comes
 * back; and, cancelled, that the chat stopped waiting (the agent's turn goes
 * on in its own conversation, contract 2.4).
 */
export function agentJobLabel(
  name: string,
  state: 'running' | 'replying' | 'done' | 'failed' | 'cancelled' | 'unanswered',
  failed: boolean,
): string {
  switch (state) {
    case 'running':
      return `Waiting for ${name}…`;
    case 'replying':
      return `${name} ${failed ? 'could not reply' : 'replied'}. Lawexa will reply shortly.`;
    case 'cancelled':
      return `Stopped waiting for ${name}`;
    case 'failed':
      return `${name} could not reply`;
    case 'unanswered':
      return failed ? `${name} could not reply` : `${name} replied`;
    default:
      return `${name} replied`;
  }
}

/** The replies a return carries, one preview row each, in the return's order. */
export function agentReplies(outcomes: readonly Pick<BackgroundJobOutcome, 'kind' | 'outcome' | 'agent_reply'>[]): (AgentReplyOutcome & {
  failed: boolean;
})[] {
  return outcomes
    .filter((outcome) => outcome.kind === 'agent_reply' && outcome.agent_reply)
    .map((outcome) => ({ ...(outcome.agent_reply as AgentReplyOutcome), failed: outcome.outcome === 'failed' }));
}

/**
 * A reply row's words: the preview as plain text (the server's preview is the
 * reply's markdown, whose "**" and "*" the row printed; S1 pictures, 12
 * November 2026), or that the agent could not reply.
 */
export function agentReplyText(reply: { agent: { name: string }; preview: string | null; failed: boolean }): string {
  if (reply.failed || !reply.preview) return `${reply.agent.name} could not reply.`;
  return plainPreview(reply.preview) || reply.preview;
}
