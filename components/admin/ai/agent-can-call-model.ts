import type { AdminAiAgent, AdminAiAgentCallee } from '@/types/admin-ai';

/**
 * The "Can call" list on an agent's page (sub-agents contract, section 5.1):
 * the agents it may message with `message_agent`. Listing the agent itself is
 * what gives it "lawexa", a fresh copy of itself. The server replaces the
 * whole list on each save (`can_call_agent_ids`), so an add or a removal sends
 * the list as it will be. Pure, so a test pins it.
 */

/** The name a callee goes by in the list: the agent itself reads as the "lawexa" it gives. */
export function calleeLabel(callee: Pick<AdminAiAgentCallee, 'id' | 'name'>, agentId: number): string {
  return callee.id === agentId ? `${callee.name} (itself, as "lawexa")` : callee.name;
}

/** The agents that can still be added: active ones not on the list yet, the agent itself first, then by name. */
export function addableAgents(
  agents: readonly Pick<AdminAiAgent, 'id' | 'name' | 'slug' | 'is_active'>[],
  listed: readonly Pick<AdminAiAgentCallee, 'id'>[],
  agentId: number,
): Pick<AdminAiAgent, 'id' | 'name' | 'slug' | 'is_active'>[] {
  const taken = new Set(listed.map((callee) => callee.id));
  return agents
    .filter((agent) => agent.is_active && !taken.has(agent.id))
    .sort((a, b) => (a.id === agentId ? -1 : b.id === agentId ? 1 : a.name.localeCompare(b.name)));
}

/** The ids to send after adding one agent: the list as it was, then the new one. */
export function idsWith(listed: readonly Pick<AdminAiAgentCallee, 'id'>[], added: number): number[] {
  const ids = listed.map((callee) => callee.id);
  return ids.includes(added) ? ids : [...ids, added];
}

/** The ids to send after removing one agent. */
export function idsWithout(listed: readonly Pick<AdminAiAgentCallee, 'id'>[], removed: number): number[] {
  return listed.map((callee) => callee.id).filter((id) => id !== removed);
}
