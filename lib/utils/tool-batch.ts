import type { BatchCall, ToolResult } from '@/types/chat';
import { isSoftenedMiss } from './softened-miss';

export type { BatchCall };

/**
 * run_together, the batch tool (Stay, thread 694678cf, 24 November 2026).
 * Lawexa sends one call with a goal ("Finding how courts treat SIM-swap
 * losses") and 2 to 8 lookups; the server runs them 4 at a time, in any order.
 * The chat draws the goal as the step's line and each lookup as a sub-row
 * under it, named as a single step is named today. Pure, so a test pins it;
 * the engine and the reload feed it.
 *
 *   live    tool_calling run_together (tool_call_id "call_b") starts the rows
 *           from its parameters; tool_batch_calling / tool_batch_complete
 *           ("call_b.1", parent "call_b") move one row each; tool_complete
 *           run_together settles every row from its results.
 *   reload  one tool_call message (tool_parameters {goal, calls}) and its
 *           result, whose metadata.batch_calls says how each lookup ended.
 *           The inner events are never saved.
 *
 * A row reads done only when its own result, the end's results or
 * batch_calls say it worked. A lookup the server softened for a reader below
 * researcher ("That lookup found nothing, so Lawexa tried another way.",
 * success true) reads failed, as a single step does (step-failure.ts). A row
 * nothing settled reads `unfinished`, and one the reader's Stop cut off reads
 * `stopped`; neither is a tick (Techlead review, 24 November 2026).
 *
 * Every end and saved entry carries `i`, the lookup's place in
 * parameters.calls counted from 1 (Backend, tool_batch.py); a refused call
 * keeps its place. A row is found by it, and by the entry's position when it
 * is missing. The inner events carry no `i`: their id ends in the same place
 * ("call_b.3" is i 3).
 */
export const RUN_TOGETHER = 'run_together';

export type BatchCallState = BatchCall['state'];

interface CallSpec {
  tool?: unknown;
  arguments?: unknown;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Whether a row has ended, any way. waiting and working have not. */
export function batchRowEnded(row: BatchCall): boolean {
  return row.state !== 'waiting' && row.state !== 'working';
}

/** A result's own words: done only when it worked and was not the server's softened miss. */
function outcome(result: ToolResult): 'done' | 'failed' {
  return result.success === true && !isSoftenedMiss(result) ? 'done' : 'failed';
}

/** An end or saved entry, as a result: `result` is its data. */
function entryResult(entry: Record<string, unknown>): ToolResult {
  return {
    success: entry.success === true,
    data: entry.result ?? null,
    error: typeof entry.error === 'string' ? entry.error : null,
  };
}

/** Entries by row: each at its `i` (from 1) when it has one in range, else at its position. */
function byRow(entries: unknown, rows: number): Array<Record<string, unknown> | undefined> {
  const placed: Array<Record<string, unknown> | undefined> = new Array(rows).fill(undefined);
  if (!Array.isArray(entries)) return placed;
  entries.forEach((value, position) => {
    const entry = record(value);
    const place = entry.i as number;
    const at = Number.isInteger(place) && place >= 1 && place <= rows ? place - 1 : position;
    if (at < rows && !placed[at]) placed[at] = entry;
  });
  return placed;
}

/** The goal line Lawexa wrote, or null when there is none. */
export function batchGoal(parameters: Record<string, unknown>): string | null {
  const goal = parameters.goal;
  return typeof goal === 'string' && goal.trim() ? goal.trim() : null;
}

/**
 * The lookups, waiting, in the order Lawexa asked for them. One row per call,
 * a call with no tool name too (the server refuses it, and it keeps its
 * place), so a row's place is the `i` the server counts.
 */
export function batchFromParameters(parameters: Record<string, unknown>): BatchCall[] {
  const calls = Array.isArray(parameters.calls) ? (parameters.calls as CallSpec[]) : [];
  return calls.map((call) => ({
    tool: typeof call?.tool === 'string' && call.tool ? call.tool : 'unknown',
    arguments: record(call?.arguments),
    state: 'waiting' as const,
  }));
}

interface InnerEvent {
  callId: string;
  tool: string;
}

/**
 * The row an inner event belongs to. A row already given this id wins, so a
 * completion finds the row its start moved. Else the place its id ends in
 * ("call_b.3" is the third lookup), when the tool matches and the row has no
 * id yet. Else the first waiting row for that tool, so an id in another form
 * still lands somewhere.
 */
function rowFor(batch: readonly BatchCall[], event: InnerEvent): number {
  const known = batch.findIndex((row) => row.callId === event.callId);
  if (known >= 0) return known;
  const free = (at: number) => batch[at]?.tool === event.tool && !batch[at].callId;
  const place = Number(event.callId.slice(event.callId.lastIndexOf('.') + 1));
  if (Number.isInteger(place) && place >= 1 && free(place - 1)) return place - 1;
  return batch.findIndex((row) => row.tool === event.tool && !row.callId && row.state === 'waiting');
}

/** tool_batch_calling: one lookup has started. A row that has ended stays as it is. */
export function batchOnCalling(batch: readonly BatchCall[], event: InnerEvent): BatchCall[] {
  const at = rowFor(batch, event);
  if (at < 0) return [...batch];
  return batch.map((row, index) =>
    index === at ? { ...row, callId: event.callId, state: row.state === 'waiting' ? 'working' : row.state } : row,
  );
}

/**
 * tool_batch_complete: one lookup has ended, in any order. A row that has
 * already ended keeps its end, so a repeated or late event changes nothing.
 */
export function batchOnComplete(
  batch: readonly BatchCall[],
  event: InnerEvent & { result: ToolResult; latencyMs?: number },
): BatchCall[] {
  const at = rowFor(batch, event);
  if (at < 0 || batchRowEnded(batch[at])) return [...batch];
  return batch.map((row, index) =>
    index === at
      ? { ...row, callId: event.callId, state: outcome(event.result), result: event.result, latencyMs: event.latencyMs }
      : row,
  );
}

/**
 * tool_complete run_together: every lookup settles from the end's results.
 * A lookup its own result marked failed stays failed. One with no result
 * keeps the end its own event gave it, or reads unfinished.
 */
export function batchOnEnd(batch: readonly BatchCall[], data: unknown): BatchCall[] {
  const results = byRow(record(data).results, batch.length);
  return batch.map((row, index) => {
    const entry = results[index];
    if (!entry) return batchRowEnded(row) ? row : { ...row, state: 'unfinished' };
    return { ...row, state: row.state === 'failed' ? 'failed' : outcome(entryResult(entry)) };
  });
}

/** The turn ended before the batch did: each lookup still open reads `stopped` or `unfinished`. */
export function batchOnHalt(batch: readonly BatchCall[], end: 'stopped' | 'unfinished'): BatchCall[] {
  return batch.map((row) => (batchRowEnded(row) ? row : { ...row, state: end }));
}

/** A reloaded batch whose turn is still running: the lookups nothing settled are waiting again. */
export function batchOnFollow(batch: readonly BatchCall[]): BatchCall[] {
  return batch.map((row) => (row.state === 'unfinished' ? { ...row, state: 'waiting' } : row));
}

/**
 * A reloaded batch: its lookups from the saved call. Each ends as batch_calls
 * says (the real success flag, kept for every reader), or as the saved
 * result's own entry says, with the softened miss read as failed either way.
 * A lookup neither mentions, or one in a step with no saved result, reads
 * unfinished; the engine opens it again when it follows a turn still running.
 */
export function batchFromReload(parameters: Record<string, unknown>, saved: unknown, result?: ToolResult): BatchCall[] {
  const rows = batchFromParameters(parameters);
  const calls = byRow(saved, rows.length);
  const results = byRow(record(result?.data).results, rows.length);
  return rows.map((row, index) => {
    const call = calls[index];
    const entry = results[index];
    const softened = entry ? isSoftenedMiss(entryResult(entry)) : false;
    const title = call?.note_title ?? call?.case_title;
    const state: BatchCallState =
      typeof call?.success === 'boolean'
        ? call.success && !softened
          ? 'done'
          : 'failed'
        : entry
          ? outcome(entryResult(entry))
          : 'unfinished';
    return { ...row, state, ...(typeof title === 'string' && title ? { entityTitle: title } : {}) };
  });
}

/** Whether every lookup has ended. */
export function batchSettled(batch: readonly BatchCall[]): boolean {
  return batch.every(batchRowEnded);
}
