import type { ToolCallingEvent, ToolCompleteEvent } from '@/types/chat';

/**
 * An agent's lookups as its row shows them while it works (live agent list,
 * thread 694678cf): one line per tool call, "Searching …" until it ends,
 * "Searched …" after. Pure, so the stream hook only feeds events in.
 */
export interface AgentLiveStep {
  /** The tool call's id, or the order it came in when the event carries none. */
  key: string;
  name: string;
  parameters: Record<string, unknown>;
  done: boolean;
  /** How many things the lookup brought back, once done; null when unknown. */
  resultCount: number | null;
}

/** A tool call started: a new line, unless the same call is already listed. */
export function stepsOnCalling(steps: readonly AgentLiveStep[], event: Pick<ToolCallingEvent, 'tool_call' | 'tool_call_id'>): AgentLiveStep[] {
  const key = event.tool_call_id ?? `call-${steps.length}`;
  if (steps.some((step) => step.key === key)) return [...steps];
  return [...steps, { key, name: event.tool_call.name, parameters: event.tool_call.parameters ?? {}, done: false, resultCount: null }];
}

/**
 * A tool call ended: its line reads done. With no id, the oldest open line of
 * the same tool ends, which is the order the model runs them in.
 */
export function stepsOnComplete(
  steps: readonly AgentLiveStep[],
  event: Pick<ToolCompleteEvent, 'tool_call' | 'tool_call_id' | 'result_count'>,
): AgentLiveStep[] {
  const index = event.tool_call_id
    ? steps.findIndex((step) => step.key === event.tool_call_id)
    : steps.findIndex((step) => !step.done && step.name === event.tool_call?.name);
  if (index === -1) return [...steps];
  const resultCount = typeof event.result_count === 'number' ? event.result_count : null;
  return steps.map((step, i) => (i === index ? { ...step, done: true, resultCount } : step));
}
