import { isHandoverMessage, isToolMessage } from '@/types/chat';
import type { EngineMessage } from '@/v2/runtime/chat-engine';

/** How much of a chat an open's first frame draws (MessageList's OPEN_TAIL). */
export interface OpenTailLimit {
  /** The most messages the first frame draws. */
  messages: number;
  /** The text the first frame draws, in characters: once reached, no older message is added. */
  chars: number;
}

/**
 * The characters a row draws when it mounts. A tool chain and a handover draw
 * their titles; their text stays folded until opened, so they count none.
 */
function drawnChars(message: EngineMessage): number {
  return isToolMessage(message) || isHandoverMessage(message) ? 0 : message.content.length;
}

/**
 * Where an open's first frame starts drawing (MessageList's OPEN_TAIL): the
 * index of the oldest message it draws, moved back to the start of the group
 * that message belongs to.
 *
 * THE CUT IS A TEXT BUDGET. The newest message always draws; older ones are
 * added until the text drawn reaches `chars`, or `messages` of them are in.
 * It used to be a count alone, and eight messages are four answers: on a chat
 * of long answers the opening frame parsed four times the text it showed,
 * since the open lands on the end of the last one. The budget is about two
 * screens, the one the reader lands on and the one a first scroll up reaches,
 * so the opening frame's parse is bounded by the screen and not by the chat.
 * A chat of short messages still draws up to the count.
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
export function openTailStart(messages: readonly EngineMessage[], limit: OpenTailLimit): number {
  let start = messages.length;
  let chars = 0;
  while (start > 0 && messages.length - start < limit.messages && chars < limit.chars) {
    start -= 1;
    chars += drawnChars(messages[start]);
  }
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
  limit: OpenTailLimit,
): { older: readonly EngineMessage[]; newest: readonly EngineMessage[] } {
  const start = openTailStart(messages, limit);
  return { older: messages.slice(0, start), newest: messages.slice(start) };
}
