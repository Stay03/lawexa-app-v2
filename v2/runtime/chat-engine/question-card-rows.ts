import { closedCard, readQuestionCard } from '@/lib/utils/question-card';
import type { ChatMessage, QuestionCardAnswer } from '@/types/chat';
import type { EngineMessage } from './types';

/**
 * question-card-rows — what the engine does to the transcript for question
 * cards (Arthur's go f6eaa156; Backend's shape, 9 November 2026).
 *
 * The server closes a card itself: answered by `question_answers`, skipped by
 * any other message, replaced by a newer card. These draw the same on screen
 * the moment the server takes the reader's send, so the card leaves the box
 * at once instead of on the next read of the chat. Each returns the same
 * array when nothing changed.
 */

/**
 * Close the open card: answered with `answers`, or skipped when the reader
 * typed instead (`answers` null).
 */
export function withOpenCardClosed(
  rows: readonly EngineMessage[],
  answers: readonly QuestionCardAnswer[] | null,
): EngineMessage[] {
  let changed = false;
  const next = rows.map((row) => {
    const card = (row as ChatMessage).questionCard;
    if (row.role !== 'assistant' || !card || card.status !== 'open') return row;
    changed = true;
    return { ...row, questionCard: closedCard(card, answers) } as EngineMessage;
  });
  return changed ? next : (rows as EngineMessage[]);
}

/**
 * The card a turn ended with, from its `completed` event's metadata, onto the
 * answer drawn from the stream (named by its saved id). A card already open
 * on screen is closed as replaced, as the server does. No metadata (a server
 * before it), or a card this app cannot read: nothing changes, and the next
 * read of the chat brings the card (`adoptServerFields`).
 */
export function withCardFromCompleted(
  rows: readonly EngineMessage[],
  answerSavedId: number | null,
  metadata: unknown,
): EngineMessage[] {
  if (answerSavedId === null) return rows as EngineMessage[];
  const card = readQuestionCard(metadata);
  if (!card) return rows as EngineMessage[];
  const index = rows.findIndex((row) => row.role === 'assistant' && row.savedId === answerSavedId);
  if (index === -1) return rows as EngineMessage[];
  const closed = withOpenCardClosed(rows, null);
  return closed.map((row, at) => (at === index ? ({ ...row, questionCard: card } as EngineMessage) : row));
}
