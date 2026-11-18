/**
 * Which agents a NEW skill goes on (Arthur, 18 November 2026: "at the point
 * of skill creation assign to both Lite and Expert as default"; server
 * d8fda929). The server keeps the default list in an admin setting and sends
 * it from GET /admin/ai-skills/default-agents. The create form starts with
 * those agents ticked, any can be unticked, and the choice goes with the
 * create as `agent_ids`. Without the field the server uses its defaults, so a
 * form that never learned them still lands on them.
 */

export interface SkillAgentOption {
  id: number;
  name: string;
}

/**
 * The ticks the form sends: the admin's own picks once they touch a box,
 * else the server's defaults, else nothing known (null).
 */
export function chosenAgentIds(picked: readonly number[] | null, defaults: readonly number[] | null): number[] | null {
  if (picked !== null) return [...picked];
  return defaults === null ? null : [...defaults];
}

/** One box turned on or off, keeping the order the agents were listed in. */
export function toggleAgentId(chosen: readonly number[], id: number, order: readonly number[]): number[] {
  const next = chosen.includes(id) ? chosen.filter((value) => value !== id) : [...chosen, id];
  return order.filter((value) => next.includes(value));
}

/**
 * The create payload's part. Known ticks are sent as they are, an empty list
 * included (the admin unticked every agent). Unknown ticks send nothing, and
 * the server puts the skill on its defaults.
 */
export function agentIdsPayload(chosen: readonly number[] | null): { agent_ids?: number[] } {
  return chosen === null ? {} : { agent_ids: [...chosen] };
}

/** The rows: the default agents first, in the server's order, then the other active agents by name. */
export function agentRows(active: readonly SkillAgentOption[], defaults: readonly SkillAgentOption[]): SkillAgentOption[] {
  const defaultIds = new Set(defaults.map((agent) => agent.id));
  const rest = active
    .filter((agent) => !defaultIds.has(agent.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...defaults, ...rest];
}

/** "Lite", "Lite and Expert", "Lite, Expert and Issue Spotter". */
export function agentNamesList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** What the create toast says about where the skill went, from the server's answer. */
export function createdOnAgents(version: number, agents: readonly { name: string }[] | undefined): string {
  const saved = `Saved as version ${version}`;
  if (agents === undefined) return `${saved}.`;
  if (agents.length === 0) return `${saved}, on no agent yet. Add one on the skill's page to use it.`;
  return `${saved}, on ${agentNamesList(agents.map((agent) => agent.name))}.`;
}
