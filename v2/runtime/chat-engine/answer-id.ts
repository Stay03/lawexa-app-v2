import type { EngineMessage } from './types';

/**
 * The server id of a turn's answer, from the ids on its `completed` event.
 *
 * The event lists every Message the turn wrote (the user's message, tool calls
 * and results, handovers, narration, the answer) as a set. On a completed turn
 * the API saves the answer LAST, after every iteration row
 * (`SavesAiResponses::saveSuccessResponse`), and ids only grow, so the answer is
 * the largest id. Read from the API code on 7 October 2026 (e106b63), not from
 * a field that names it; `null` when the turn saved nothing (a confidential
 * chat sends `[]`).
 */
export function answerMessageId(ids: readonly number[] | undefined): number | null {
  if (!ids || ids.length === 0) return null;
  return Math.max(...ids);
}

/** A plain answer row: an assistant text row; handover, narration and error rows carry a `messageType`. */
function isAnswerRow(message: EngineMessage): boolean {
  return message.role === 'assistant' && !('messageType' in message && message.messageType);
}

/**
 * Gives the current turn's answer row its server id. The turn is everything
 * after the last user row; its answer is the last answer row in it. A row that
 * already has an id (from history, `msg_{id}`, or stamped before by a replayed
 * `completed`) is left alone, so a repeat of the event changes nothing.
 * Returns the same array when there is nothing to stamp.
 */
export function stampAnswerId(
  messages: readonly EngineMessage[],
  savedId: number,
  isLocalRow: (id: string) => boolean,
): EngineMessage[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'user') break;
    if (!isAnswerRow(message)) continue;
    if (!isLocalRow(message.id) || message.savedId !== undefined || !message.content.trim()) break;
    const next = messages.slice();
    next[i] = { ...message, savedId };
    return next;
  }
  return messages as EngineMessage[];
}
