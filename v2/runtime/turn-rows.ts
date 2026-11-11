/**
 * Turns and lines (Stay, 30 October 2026, 02:16Z, thread 1e44eb39; design
 * 9b43f942). A chat can now hold quiet lines beside its turns ("Stay edited
 * 'Lease agreement' · 17:49", role `event`). Every rule that reads "the last
 * row" means the last TURN: a question waiting for its answer is still
 * waiting with a line under it, and an answer is still the last answer. Each
 * such rule asks here, so a line never answers for a turn.
 *
 * Generic over the row shape, so the same rule serves the engine's rows and
 * the raw rows a stored chat keeps (persist/policy.ts).
 */

/** Any row with a role: a drawn row or a server row. */
interface HasRole {
  role?: unknown;
}

/** A question, an answer, a step: anything but a line. */
export function isTurnRow(row: HasRole): boolean {
  return row.role !== 'event';
}

/** The last row that is a turn, skipping lines after it; `undefined` when there is none. */
export function lastTurnRow<T extends HasRole>(rows: readonly T[]): T | undefined {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (isTurnRow(rows[i])) return rows[i];
  }
  return undefined;
}

/** The index of {@link lastTurnRow}, `-1` when there is none. */
export function lastTurnIndex(rows: readonly HasRole[]): number {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (isTurnRow(rows[i])) return i;
  }
  return -1;
}

/** How many rows are turns: the "New message" pill counts these, never lines. */
export function turnRowCount(rows: readonly HasRole[]): number {
  let count = 0;
  for (const row of rows) if (isTurnRow(row)) count += 1;
  return count;
}

/** A row's role and, for a line, its kind. */
interface HasRoleAndKind extends HasRole {
  eventType?: unknown;
}

/**
 * Lawexa back from background work (Backend's shapes 063d9cc3): the server
 * stores it as the turn's USER row, and v2 draws it as a line
 * (`BackgroundJobEvent`). For where a turn starts, it is a question.
 */
export function isBackgroundReturn(row: HasRoleAndKind): boolean {
  return row.role === 'event' && row.eventType === 'background_job_result';
}

/**
 * Where the latest turn starts: its question, or Lawexa's return from
 * background work, whichever is later; -1 when there is neither. What the
 * server counts as the turn's user row, so a merge of the turn's rows cuts
 * here, and a retry never reaches past a return to re-ask an older question
 * (which would start the background work again; live review of 8d263fb2).
 */
export function lastTurnStartIndex(rows: readonly HasRoleAndKind[]): number {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].role === 'user' || isBackgroundReturn(rows[i])) return i;
  }
  return -1;
}
