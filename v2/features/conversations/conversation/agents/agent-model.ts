/**
 * agents model — the pure rules of sub-agents in a chat (contract:
 * docs/api/sub-agents-contract.md, sections 3 and 4). Lawexa messages another
 * agent with `message_agent`; the agent answers in an agent conversation of
 * its own, in the background; Lawexa is woken with its reply. The call shows
 * as Lawexa's step ("Writing to Issue Spotter"); the agent itself is a row
 * after the turn's answer (agent-roster.ts).
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
