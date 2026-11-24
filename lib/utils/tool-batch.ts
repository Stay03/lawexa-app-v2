import type { BatchCall, ToolResult } from '@/types/chat';

export type { BatchCall };

/**
 * run_together, the batch tool (Stay, thread 694678cf, 24 November 2026).
 * Lawexa sends one call with a goal ("Finding how courts treat SIM-swap
 * losses") and 2 to 8 lookups; the server runs them 4 at a time, in any order.
 * The chat draws the goal as the step's line and each lookup as a sub-row
 * under it, named as a single step is named today, each working, done or
 * failed. Pure, so a test pins it; the engine and the reload feed it.
 *
 *   live    tool_calling run_together (tool_call_id "call_b") starts the rows
 *           from its parameters; tool_batch_calling / tool_batch_complete
 *           ("call_b.1", parent "call_b") move one row each; tool_complete
 *           run_together settles every row from its results, in input order.
 *   reload  one tool_call message (tool_parameters {goal, calls}) and its
 *           result, whose metadata.batch_calls says how each lookup ended.
 *           The inner events are never saved.
 */
export const RUN_TOGETHER = 'run_together';

export type BatchCallState = BatchCall['state'];

interface CallSpec {
  tool?: unknown;
  arguments?: unknown;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** The goal line Lawexa wrote, or null when there is none. */
export function batchGoal(parameters: Record<string, unknown>): string | null {
  const goal = parameters.goal;
  return typeof goal === 'string' && goal.trim() ? goal.trim() : null;
}

/** The lookups, waiting, in the order Lawexa asked for them. */
export function batchFromParameters(parameters: Record<string, unknown>): BatchCall[] {
  const calls = Array.isArray(parameters.calls) ? (parameters.calls as CallSpec[]) : [];
  return calls
    .filter((call) => typeof call?.tool === 'string' && call.tool)
    .map((call) => ({ tool: call.tool as string, arguments: record(call.arguments), state: 'waiting' as const }));
}

/**
 * The row an inner event belongs to. Its id ends in its place in the batch
 * ("call_b.3" is the third lookup); the tool must match. A row already given
 * this id wins, so a completion finds the row its start moved. Else the first
 * waiting row for that tool, so an id in another form still lands somewhere.
 */
function rowFor(batch: readonly BatchCall[], callId: string, tool: string): number {
  const known = batch.findIndex((row) => row.callId === callId);
  if (known >= 0) return known;
  const place = Number(callId.slice(callId.lastIndexOf('.') + 1));
  if (Number.isInteger(place) && place >= 1 && batch[place - 1]?.tool === tool && !batch[place - 1].callId) return place - 1;
  return batch.findIndex((row) => row.tool === tool && !row.callId && row.state === 'waiting');
}

/** tool_batch_calling: one lookup has started. */
export function batchOnCalling(batch: readonly BatchCall[], event: { callId: string; tool: string }): BatchCall[] {
  const at = rowFor(batch, event.callId, event.tool);
  if (at < 0) return [...batch];
  return batch.map((row, index) => (index === at ? { ...row, callId: event.callId, state: row.state === 'waiting' ? 'working' : row.state } : row));
}

/** tool_batch_complete: one lookup has ended, in any order. */
export function batchOnComplete(
  batch: readonly BatchCall[],
  event: { callId: string; tool: string; result: ToolResult; latencyMs?: number },
): BatchCall[] {
  const at = rowFor(batch, event.callId, event.tool);
  if (at < 0) return [...batch];
  return batch.map((row, index) =>
    index === at
      ? { ...row, callId: event.callId, state: event.result.success ? 'done' : 'failed', result: event.result, latencyMs: event.latencyMs }
      : row,
  );
}

interface EndResult {
  success?: unknown;
}

/** tool_complete run_together: every lookup settles from the results, which come in input order. */
export function batchOnEnd(batch: readonly BatchCall[], data: unknown): BatchCall[] {
  const results = Array.isArray(record(data).results) ? (record(data).results as EndResult[]) : [];
  return batch.map((row, index) => {
    const result = results[index];
    if (!result) return row.state === 'done' || row.state === 'failed' ? row : { ...row, state: 'failed' };
    return { ...row, state: result.success === true ? 'done' : 'failed' };
  });
}

interface SavedCall {
  success?: unknown;
  note_title?: unknown;
  case_title?: unknown;
}

/** A reloaded batch: its lookups from the saved call, each ended as batch_calls says (in input order). */
export function batchFromReload(parameters: Record<string, unknown>, saved: unknown): BatchCall[] {
  const outcomes = Array.isArray(saved) ? (saved as SavedCall[]) : [];
  return batchFromParameters(parameters).map((row, index) => {
    const outcome = outcomes[index];
    const title = outcome?.note_title ?? outcome?.case_title;
    return {
      ...row,
      state: outcome ? (outcome.success === true ? 'done' : 'failed') : 'done',
      ...(typeof title === 'string' && title ? { entityTitle: title } : {}),
    };
  });
}

/** Whether every lookup has ended. */
export function batchSettled(batch: readonly BatchCall[]): boolean {
  return batch.every((row) => row.state === 'done' || row.state === 'failed');
}
