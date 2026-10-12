import { isHandoverMessage, isToolMessage } from '@/types/chat';
import type { EngineMessage } from '@/v2/runtime/chat-engine';

/**
 * Where an open's first frame starts drawing (MessageList's OPEN_TAIL_MESSAGES):
 * the index of the oldest message it draws, `count` messages from the end,
 * moved back to the start of the group that message belongs to.
 *
 * WHY THE CUT MOVES BACK. `groupMessages` folds a run of tool steps into one
 * chain, and a handover with the steps it spawned into one group, each keyed by
 * its first message (MessageList's groupKey). A cut inside a run drew the
 * chain's later half in the first frame under another key, or a handover's
 * steps as a plain chain; when the rest arrived React dropped that row and
 * mounted the whole one in its place, so the chain lost its state and its
 * height changed under the reader. Cut at a group's start, every group the
 * first frame draws is the same group, with the same key, in the full list.
 */
export function openTailStart(messages: readonly EngineMessage[], count: number): number {
  let start = Math.max(0, messages.length - count);
  while (start > 0 && isToolMessage(messages[start])) {
    const before = messages[start - 1];
    if (!isToolMessage(before) && !isHandoverMessage(before)) break;
    start -= 1;
  }
  return start;
}

/**
 * The open's two parts: `newest`, drawn in the first frame, and `older`, drawn
 * right after it, above. Together they are the whole list in its order;
 * nothing is left out.
 */
export function splitOpenTail(
  messages: readonly EngineMessage[],
  count: number,
): { older: readonly EngineMessage[]; newest: readonly EngineMessage[] } {
  const start = openTailStart(messages, count);
  return { older: messages.slice(0, start), newest: messages.slice(start) };
}
