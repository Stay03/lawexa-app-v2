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

/** The rows of the turn on screen: everything after the last question. */
function currentTurn(rows: readonly EngineMessage[]): readonly EngineMessage[] {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].role === 'user') return rows.slice(i + 1);
  }
  return rows;
}

/** The text of the turn's last finished answer row (not a tool step, a handover, a narration or an error), or null. */
function shownAnswer(rows: readonly EngineMessage[]): string | null {
  const turn = currentTurn(rows);
  for (let i = turn.length - 1; i >= 0; i -= 1) {
    const row = turn[i];
    if (row.role !== 'assistant' || ('messageType' in row && row.messageType) || row.isStreaming) continue;
    return row.content.trim() ? row.content : null;
  }
  return null;
}

/**
 * What a terminal WITHOUT TEXT draws when no answer is streaming (Fable's
 * review of 1917ffeb, 14 November 2026). A confidential chat's terminal
 * rebuilt from the database carries no text (`replayable: false`), so the
 * engine reads the answer from the device's transcript. It used to append it
 * as a new row whenever no placeholder was open, with no look at the screen;
 * a terminal delivered twice (a late follow, or the stream's own reconnect
 * between `completed` and `end`) drew the answer twice. Stored chats are
 * spared by `answerAlreadyShown`, keyed on saved ids a confidential chat
 * never has, so this compares what the turn shows:
 * - `answer`: the transcript's answer is not on screen yet, draw it;
 * - `nothing`: the turn already shows it (or shows an answer and the
 *   transcript cannot be read: the chat has not ended on this device);
 * - `lost`: no answer anywhere, say the conversation ended on this device.
 */
export function textlessTerminalDraw(
  rows: readonly EngineMessage[],
  savedAnswer: string | null,
): 'answer' | 'nothing' | 'lost' {
  const shown = shownAnswer(rows);
  if (savedAnswer && savedAnswer.trim()) {
    return shown !== null && shown.trim() === savedAnswer.trim() ? 'nothing' : 'answer';
  }
  return shown !== null ? 'nothing' : 'lost';
}

/**
 * Whether the turn already ends with this error. A terminal error delivered
 * again (the stream reconnecting on its own after a drop) drew a second error
 * row in any chat; the same error, last in the turn, is drawn once.
 */
export function turnEndsWithError(rows: readonly EngineMessage[], content: string, errorCode: string): boolean {
  const last = currentTurn(rows).at(-1);
  return (
    last !== undefined &&
    last.role === 'assistant' &&
    'messageType' in last &&
    last.messageType === 'error' &&
    last.errorCode === errorCode &&
    last.content === content
  );
}
