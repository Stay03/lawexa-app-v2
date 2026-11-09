import type { ChatMessage, ConversationMessage } from '@/types/chat';
import { hasUnresolvedDraftEdits } from '@/lib/utils/draft-edits';
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
 * The same holds for what redaction hid (`redaction`), on a row that has none.
 *
 * The local row keeps its id, its text and everything else; only those fields
 * are taken, and only when the server's copy has them. Returns the same
 * array when nothing changed, so a merge that adds nothing still renders nothing.
 */
export function adoptServerFields(
  rows: readonly EngineMessage[],
  serverRows: readonly ConversationMessage[],
): EngineMessage[] {
  const copies = new Map<number, ChatMessage>();
  const cards = new Map<number, ChatMessage>();
  for (const row of serverRows) {
    if (!row.id.startsWith(SERVER_ROW_PREFIX)) continue;
    const id = Number(row.id.slice(SERVER_ROW_PREFIX.length));
    if (!Number.isSafeInteger(id)) continue;
    if (row.role === 'user') copies.set(id, row as ChatMessage);
    else if (row.role === 'assistant' && (row as ChatMessage).questionCard) cards.set(id, row as ChatMessage);
  }
  if (copies.size === 0 && cards.size === 0) return rows as EngineMessage[];

  let changed = false;
  const next = rows.map((row) => {
    if (row.role === 'assistant') {
      const fields = cardFields(row, cards);
      if (!fields) return row;
      changed = true;
      return { ...row, ...fields } as EngineMessage;
    }
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
    // What redaction hid (redacted chats, 22 October 2026), for a row that did
    // not get it from its own send: the first question of a chat, which the home
    // screen sends. A row that already has it keeps its own.
    if (copy.redaction !== undefined && local.redaction === undefined) fields.redaction = copy.redaction;
    // The answers a question card's reply sent: a row this client drew has them
    // from its own send; one it drew without them (the home handoff) takes them.
    if (copy.cardAnswers !== undefined && local.cardAnswers === undefined) fields.cardAnswers = copy.cardAnswers;
    if (Object.keys(fields).length === 0) return row;
    changed = true;
    return { ...row, ...fields } as EngineMessage;
  });
  return changed ? next : (rows as EngineMessage[]);
}

/**
 * Give an answer on screen the server's word on its draft edits (Tester
 * 394c79d9, Techlead 53aeb072). An answer is drawn from the stream as Lawexa
 * wrote it, `<draft-edit>` blocks and all; the server applies them after the
 * answer is saved, in a job, and the transcript then reads each one as the
 * version it made, or marks it failed (lib/utils/draft-edits.ts). The merge
 * only adds rows, so without this the answer kept its edits as written, and a
 * failed one read "Changes to …" until the chat was opened again.
 *
 * The server's copy is found by the answer's saved id (a row this engine drew)
 * or its own row id (one read from history before the job ran). Its text and
 * the edits' base texts are taken only once the copy has no edit left
 * unanswered; until then the row stays as it is. Returns the same array when
 * nothing changed.
 */
export function adoptDraftEditResults(
  rows: readonly EngineMessage[],
  serverRows: readonly ConversationMessage[],
): EngineMessage[] {
  const copies = new Map<string, ChatMessage>();
  for (const row of serverRows) {
    if (row.role !== 'assistant' || !row.id.startsWith(SERVER_ROW_PREFIX)) continue;
    copies.set(row.id, row as ChatMessage);
  }
  if (copies.size === 0) return rows as EngineMessage[];

  let changed = false;
  const next = rows.map((row) => {
    if (row.role !== 'assistant') return row;
    const local = row as EngineMessage & ChatMessage;
    if (local.isStreaming || typeof local.content !== 'string' || !hasUnresolvedDraftEdits(local.content)) return row;
    const copy = copies.get(row.id.startsWith(SERVER_ROW_PREFIX) ? row.id : `${SERVER_ROW_PREFIX}${row.savedId ?? ''}`);
    if (!copy || typeof copy.content !== 'string' || hasUnresolvedDraftEdits(copy.content) || copy.content === local.content) return row;
    changed = true;
    return { ...row, content: copy.content, draftEditBases: copy.draftEditBases } as EngineMessage;
  });
  return changed ? next : (rows as EngineMessage[]);
}

/**
 * A question card from the server's copy of an answer on screen, named by its
 * saved id (a streamed answer) or its own `msg_` id (one read from history).
 * It is how a card reaches a streamed answer when the turn's `completed` did
 * not carry it, and how a card a colleague answered closes here (question
 * cards, 9 November 2026). Never the other way: a read that started before
 * the reader's own answer went could still say "open", and a card closed on
 * this screen stays closed.
 */
function cardFields(row: EngineMessage, cards: ReadonlyMap<number, ChatMessage>): Partial<ChatMessage> | null {
  const id =
    row.savedId ??
    (row.id.startsWith(SERVER_ROW_PREFIX) ? Number(row.id.slice(SERVER_ROW_PREFIX.length)) : Number.NaN);
  const copy = cards.get(id)?.questionCard;
  if (!copy) return null;
  const local = (row as ChatMessage).questionCard;
  if (local === undefined) return { questionCard: copy };
  if (local.status === 'open' && copy.status !== 'open') return { questionCard: copy };
  return null;
}
