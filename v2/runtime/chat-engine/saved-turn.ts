import type { ApiMessage } from '@/types/chat';
import type { EngineMessage } from './types';

/** The server's prefix on a row id read from history (`msg_{id}`). */
const SERVER_ROW_PREFIX = 'msg_';

/**
 * The largest saved id on screen: the rows read from history (`msg_{id}`) and
 * the rows this engine drew that carry their saved id. A question saved by the
 * send being checked has a larger one. 0 for a chat with nothing saved yet.
 */
export function largestSavedId(rows: readonly EngineMessage[]): number {
  let largest = 0;
  for (const row of rows) {
    const id = row.savedId ?? (row.id.startsWith(SERVER_ROW_PREFIX) ? Number(row.id.slice(SERVER_ROW_PREFIX.length)) : NaN);
    if (Number.isSafeInteger(id) && id > largest) largest = id;
  }
  return largest;
}

/**
 * Whether the server saved the question a failed send carried (techlead, 15
 * October 2026). A 5xx, or a connection lost after the request went out, can
 * come after the server had already written the question: then it is in the
 * chat, and giving the words back would have the reader send it twice.
 *
 * It is the newest user row, saved after everything this screen already held
 * (`afterId`), with the same text. Anything else, and nothing, is "not saved":
 * the words go back. Returns its saved id, or null.
 */
export function savedTurnId(messages: readonly ApiMessage[], text: string, afterId: number): number | null {
  const wanted = withoutFileMarkers(text);
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const row = messages[i];
    if (row.role !== 'user') continue;
    if (row.id <= afterId) return null;
    return withoutFileMarkers(row.content) === wanted ? row.id : null;
  }
  return null;
}

/** The server writes a marker into a saved question for each file it carries
 *  (`<attached_image name="a.png" />`, rows/UserMessageRow.tsx); the words sent had none. */
function withoutFileMarkers(text: string): string {
  return text.replace(/\s*<attached_(?:image|document)\b[^>]*\/>/g, '').trim();
}
