/* Pairing a tool or handover result with the call that asked for it (16 November 2026).
 *
 * The AI service can run several calls in one iteration, and their results can come
 * back in any order. Backend now sends `tool_call_id`, the same value on a call and
 * its result: top-level on the live tool_calling, tool_complete, handover_started and
 * handover_complete events, and `metadata.tool_call_id` on the saved tool_call,
 * tool_result, handover and handover_result rows. When both sides carry it, the id
 * decides. Older events and rows have no id, and they keep the old pairing: live by
 * tool name (or agent) in arrival order, history by iteration in saved order. */

/** Live pairing: a call opens a row, its result closes it. */
export interface CallMatcher {
  /** A call arrived and opened row `rowId`. `key` is the tool name or the agent slug. */
  open(key: string, rowId: string, callId?: string): void;
  /** A result arrived: the row it belongs to, or undefined when no open row matches. */
  close(key: string, callId?: string): string | undefined;
  clear(): void;
}

export function createCallMatcher(): CallMatcher {
  // Rows still waiting for a result, per key, in the order their calls arrived.
  const waiting = new Map<string, string[]>();
  const rowByCallId = new Map<string, string>();
  return {
    open(key, rowId, callId) {
      waiting.set(key, [...(waiting.get(key) ?? []), rowId]);
      if (callId) rowByCallId.set(callId, rowId);
    },
    close(key, callId) {
      const pending = waiting.get(key) ?? [];
      const exact = callId ? rowByCallId.get(callId) : undefined;
      if (callId) rowByCallId.delete(callId);
      const rowId = exact ?? pending[0];
      if (rowId === undefined) return undefined;
      waiting.set(
        key,
        pending.filter((id) => id !== rowId),
      );
      // A row closed by order forgets its own id, so it cannot close twice.
      for (const [id, row] of rowByCallId) if (row === rowId) rowByCallId.delete(id);
      return rowId;
    },
    clear() {
      waiting.clear();
      rowByCallId.clear();
    },
  };
}

/** History pairing: the saved results of one kind, taken by the calls that read them. */
export interface ResultPool<R> {
  /** The result for a call saved at `iteration` with `callId`, or undefined. Each result is taken once. */
  take(iteration: number | undefined, callId?: string): R | undefined;
}

export function createResultPool<R>(
  results: R[],
  read: (result: R) => { iteration?: number; callId?: string },
  /** The ids the calls of this kind carry. A result whose id is here waits for that call. */
  callIds: ReadonlySet<string>,
): ResultPool<R> {
  const byIteration = new Map<number, R[]>();
  const byCallId = new Map<string, R>();
  for (const result of results) {
    const { iteration, callId } = read(result);
    if (callId) byCallId.set(callId, result);
    if (iteration !== undefined) byIteration.set(iteration, [...(byIteration.get(iteration) ?? []), result]);
  }
  const remove = (result: R) => {
    const { iteration, callId } = read(result);
    if (callId) byCallId.delete(callId);
    if (iteration === undefined) return;
    const list = byIteration.get(iteration);
    if (list) byIteration.set(iteration, list.filter((r) => r !== result));
  };
  return {
    take(iteration, callId) {
      const exact = callId ? byCallId.get(callId) : undefined;
      const result =
        exact ??
        (iteration === undefined
          ? undefined
          : byIteration.get(iteration)?.find((r) => {
              const id = read(r).callId;
              return !id || !callIds.has(id);
            }));
      if (result !== undefined) remove(result);
      return result;
    },
  };
}
