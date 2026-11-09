import { closedCard, isSkipped, readQuestionCard } from '@/lib/utils/question-card';
import type { ChatMessage, QuestionCardAnswer } from '@/types/chat';
import type { EngineMessage } from './types';

/**
 * The answers as the server takes them: an option, own words, or a skip, and
 * nothing else. The labels the app keeps for its own "You chose" line stay
 * off the wire; the server names the options itself.
 */
export function answersPayload(answers: readonly QuestionCardAnswer[]): QuestionCardAnswer[] {
  return answers.map((answer) => {
    if (isSkipped(answer)) return { skipped: true };
    if ('text' in answer) return { text: answer.text };
    return { option: answer.option };
  });
}

/**
 * The server's sentence for refused answers (Backend 54b85a68: a plain
 * `{ message }`; a validation 422 names its field in `errors`). Empty when it
 * sent none.
 */
export function cardRefusalSentence(body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  const { message, errors } = body as { message?: unknown; errors?: unknown };
  if (typeof errors === 'object' && errors !== null) {
    for (const value of Object.values(errors)) {
      const first: unknown = Array.isArray(value) ? value[0] : value;
      if (typeof first === 'string' && first.trim() !== '') return first;
    }
  }
  return typeof message === 'string' ? message : '';
}

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
 * New answers to an answered card (Arthur, 05650d00): the card keeps its
 * place and takes them, as the server stores them.
 */
export function withCardAmended(
  rows: readonly EngineMessage[],
  cardMessageId: number,
  answers: readonly QuestionCardAnswer[],
): EngineMessage[] {
  let changed = false;
  const next = rows.map((row) => {
    const card = (row as ChatMessage).questionCard;
    const id = row.savedId ?? (/^msg_(\d+)$/.exec(row.id) ? Number(row.id.slice(4)) : null);
    if (row.role !== 'assistant' || !card || id !== cardMessageId) return row;
    changed = true;
    return { ...row, questionCard: { ...card, status: 'answered', answers: [...answers] } } as EngineMessage;
  });
  return changed ? next : (rows as EngineMessage[]);
}

/**
 * The card a turn ended with, from its `completed` event's `question_card`,
 * onto the answer drawn from the stream (named by its saved id). A card
 * already open on screen is closed as replaced, as the server does. No card
 * on the event (a server before it), or one this app cannot read: nothing
 * changes, and the next read of the chat brings the card (`adoptServerFields`).
 *
 * A confidential chat saves no message, so its answer has no saved id: with
 * `unsaved`, the card goes on the last answer drawn instead.
 */
export function withCardFromCompleted(
  rows: readonly EngineMessage[],
  answerSavedId: number | null,
  questionCard: unknown,
  unsaved = false,
): EngineMessage[] {
  const card = readQuestionCard(questionCard);
  if (!card) return rows as EngineMessage[];
  const index =
    answerSavedId !== null
      ? rows.findIndex((row) => row.role === 'assistant' && row.savedId === answerSavedId)
      : unsaved
        ? rows.findLastIndex((row) => row.role === 'assistant' && !('messageType' in row))
        : -1;
  if (index === -1) return rows as EngineMessage[];
  const closed = withOpenCardClosed(rows, null);
  return closed.map((row, at) => (at === index ? ({ ...row, questionCard: card } as EngineMessage) : row));
}
