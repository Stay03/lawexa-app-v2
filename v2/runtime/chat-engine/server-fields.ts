import type { ChatMessage, ConversationMessage } from '@/types/chat';
import type { EngineMessage } from './types';

/** The server's prefix on a row id read from history (`msg_{id}`). */
const SERVER_ROW_PREFIX = 'msg_';

/**
 * Give the questions this engine drew the fields only the server knows, from
 * the server's copies of them (space chats, 14 October 2026).
 *
 * A question the reader sent stays on screen as the row this client drew, with
 * its local id: the merges keep it and skip the server's copy, which the
 * engine recognises by the saved id the send was answered with (`savedId`).
 * That copy is the only place some fields exist: who the question tags
 * (`mentions`, which the send's answer does not carry), who asked (`author`),
 * and which `@`s tagged nobody (`unmatchedHandles`). Without this the writer
 * saw their own `@chidi` as plain text until they opened the chat again, while
 * everyone else saw the chip.
 *
 * The local row keeps its id, its text and everything else; only those three
 * fields are taken, and only when the server's copy has them. Returns the same
 * array when nothing changed, so a merge that adds nothing still renders nothing.
 */
export function adoptServerFields(
  rows: readonly EngineMessage[],
  serverRows: readonly ConversationMessage[],
): EngineMessage[] {
  const copies = new Map<number, ChatMessage>();
  for (const row of serverRows) {
    if (row.role !== 'user' || !row.id.startsWith(SERVER_ROW_PREFIX)) continue;
    const id = Number(row.id.slice(SERVER_ROW_PREFIX.length));
    if (Number.isSafeInteger(id)) copies.set(id, row as ChatMessage);
  }
  if (copies.size === 0) return rows as EngineMessage[];

  let changed = false;
  const next = rows.map((row) => {
    if (row.role !== 'user' || row.savedId === undefined) return row;
    const copy = copies.get(row.savedId);
    if (!copy) return row;
    const local = row as EngineMessage & ChatMessage;
    const fields: Partial<ChatMessage> = {};
    if (copy.mentions !== undefined && copy.mentions !== local.mentions) fields.mentions = copy.mentions;
    if (copy.author !== undefined && copy.author !== local.author) fields.author = copy.author;
    if (copy.unmatchedHandles !== undefined && copy.unmatchedHandles !== local.unmatchedHandles) {
      fields.unmatchedHandles = copy.unmatchedHandles;
    }
    if (Object.keys(fields).length === 0) return row;
    changed = true;
    return { ...row, ...fields } as EngineMessage;
  });
  return changed ? next : (rows as EngineMessage[]);
}
