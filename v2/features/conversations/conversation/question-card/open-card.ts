import type { ChatMessage, ConversationMessage, QuestionCard } from '@/types/chat';
import { isEventMessage } from '@/types/chat';
import { savedMessageId } from '../markdown/export-target';

/** The card the dock shows above the box, and the saved id its answers name. */
export interface OpenCard {
  cardMessageId: number;
  card: QuestionCard;
}

/**
 * The open question card, if the chat ends with one (Arthur's go f6eaa156).
 *
 * Only the LAST turn row can be it: Lawexa asks as the turn's final answer and
 * waits, so anything after the card (the reader's reply, a colleague's turn)
 * means it is closed, whatever status a stale copy still says. Lines beside
 * the turns (the draft "edited" line) do not count. The card needs its saved
 * id, which its answers name (`card_message_id`): a row still drawn from the
 * stream without one waits for it, so no answer can go out unnamed.
 */
export function openCardOf(messages: readonly ConversationMessage[]): OpenCard | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const row = messages[index];
    if (isEventMessage(row)) continue;
    const card = (row as ChatMessage).questionCard;
    if (row.role !== 'assistant' || !card || card.status !== 'open' || row.isStreaming) return null;
    const cardMessageId = (row as { savedId?: number }).savedId ?? savedMessageId(row.id);
    return cardMessageId === null ? null : { cardMessageId, card };
  }
  return null;
}
