import type { EngineMessage } from './types';

/** The server's prefix on a row id read from history (`msg_{id}`). */
const SERVER_ROW_PREFIX = 'msg_';

/** A row's saved id: its own when read from history, or the one stamped on a row this engine drew. */
function savedIdOf(row: EngineMessage): number | null {
  if (row.savedId !== undefined) return row.savedId;
  if (!row.id.startsWith(SERVER_ROW_PREFIX)) return null;
  const id = Number(row.id.slice(SERVER_ROW_PREFIX.length));
  return Number.isSafeInteger(id) ? id : null;
}

/**
 * Whether a run's answer was already on screen when the app attached to the
 * run: a row held at connect carries the answer's saved id.
 *
 * The server can report a run as still going after it ended (B4 give-up
 * chat, 12 November 2026: status "pending" on the ended run, after the
 * give-up line). The app then attaches, the stream sends that run's
 * `completed` again, and the answer was drawn a second time under the
 * give-up line. Only rows held at connect count: the rows this connection
 * draws are the copies being checked.
 */
export function answerAlreadyShown(
  rows: readonly EngineMessage[],
  answerId: number | null,
  heldAtConnect: ReadonlySet<string>,
): boolean {
  if (answerId === null) return false;
  return rows.some((row) => heldAtConnect.has(row.id) && savedIdOf(row) === answerId);
}

/**
 * The rows without what the connection drew while it replayed a run whose
 * answer was already shown: its text and tool steps. The question, the
 * lines beside the turns (draft edits, background work) and everything held
 * at connect stay.
 */
export function withoutReplayedRows(
  rows: readonly EngineMessage[],
  heldAtConnect: ReadonlySet<string>,
): EngineMessage[] {
  return rows.filter((row) => heldAtConnect.has(row.id) || row.role === 'user' || row.role === 'event');
}
