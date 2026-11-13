import type { ChatMessage, ConversationMessage, QuestionCard } from '@/types/chat';
import { isEventMessage } from '@/types/chat';
import { savedMessageId } from '../markdown/export-target';

/**
 * The questions the reader can answer, the row of Lawexa's answer that asks
 * them, and the saved id the answers name: null in a confidential chat, which
 * saves no message, so the answers go as plain text.
 */
export interface OpenCard {
  rowId: string;
  cardMessageId: number | null;
  card: QuestionCard;
}

/**
 * The open question card, if the chat ends with one (Arthur's go f6eaa156).
 *
 * Only the LAST turn row can be it: Lawexa asks as the turn's final answer and
 * waits, so anything after the card (the reader's reply, a colleague's turn)
 * means it is closed, whatever status a stale copy still says. Lines beside
 * the turns (the draft "edited" line) do not count.
 *
 * The card needs its saved id, which its answers name (`card_message_id`): a
 * row drawn from the stream without one waits for it, so no answer can go out
 * unnamed. In a confidential chat (`unsaved`) nothing is saved, and the card
 * is offered without one.
 */
export function openCardOf(messages: readonly ConversationMessage[], unsaved = false): OpenCard | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const row = messages[index];
    if (isEventMessage(row)) continue;
    // The reader's own message, drawn before the server took it: not yet a
    // turn after the card. A refused send takes it away again, and the card
    // must still be there with the reader's choices and the reason (fixture
    // run, 9 Nov). An accepted send closes the card itself (the engine).
    if (row.role === 'user' && (row as ChatMessage).drawnHere && (row as { savedId?: number }).savedId === undefined) continue;
    const card = (row as ChatMessage).questionCard;
    if (row.role !== 'assistant' || !card || card.status !== 'open' || row.isStreaming) return null;
    const cardMessageId = (row as { savedId?: number }).savedId ?? savedMessageId(row.id);
    if (cardMessageId === null && !unsaved) return null;
    return { rowId: row.id, cardMessageId, card };
  }
  return null;
}
