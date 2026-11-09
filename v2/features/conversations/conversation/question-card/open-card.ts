import type { ChatMessage, ConversationMessage, QuestionCard, QuestionCardAnswer } from '@/types/chat';
import { isEventMessage } from '@/types/chat';
import { savedMessageId } from '../markdown/export-target';

/**
 * The card the box shows above itself, and the saved id its answers name:
 * null in a confidential chat, which saves no message, so the answers go as
 * plain text.
 */
export interface OpenCard {
  cardMessageId: number | null;
  card: QuestionCard;
  /**
   * Reopened to change its answers (Arthur, 05650d00): it starts on them,
   * sends with `amend`, and × keeps them instead of skipping.
   */
  amend?: { prefill: (QuestionCardAnswer | null)[] };
}

/** The chat's latest card, answered, whose answers can still be changed, and the row that answered it last. */
export interface AmendTarget {
  cardMessageId: number;
  card: QuestionCard;
  /** The row whose "You chose" line carries Change answers. */
  answerRowId: string;
}

/**
 * The card whose answers can be changed (Arthur, 05650d00): only the LATEST
 * card in the chat, once answered, and only from the latest row that answered
 * it. A newer card, an unanswered one, or one without a saved id (a
 * confidential chat, which can name none) offers nothing.
 */
export function amendTargetOf(messages: readonly ConversationMessage[]): AmendTarget | null {
  let answerRowId: string | null = null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const row = messages[index];
    if (isEventMessage(row)) continue;
    const chat = row as ChatMessage;
    if (row.role === 'user' && chat.cardAnswers && answerRowId === null) {
      answerRowId = row.id;
      continue;
    }
    const card = chat.questionCard;
    if (row.role !== 'assistant' || !card) continue;
    // The latest card decides: answered, with a row that answered it, or nothing.
    if (card.status !== 'answered' || answerRowId === null) return null;
    const cardMessageId = (row as { savedId?: number }).savedId ?? savedMessageId(row.id);
    if (cardMessageId === null) return null;
    const answering = messages.find((m) => m.id === answerRowId) as ChatMessage | undefined;
    return answering?.cardAnswers?.cardMessageId === cardMessageId ? { cardMessageId, card, answerRowId } : null;
  }
  return null;
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
    const card = (row as ChatMessage).questionCard;
    if (row.role !== 'assistant' || !card || card.status !== 'open' || row.isStreaming) return null;
    const cardMessageId = (row as { savedId?: number }).savedId ?? savedMessageId(row.id);
    if (cardMessageId === null && !unsaved) return null;
    return { cardMessageId, card };
  }
  return null;
}
