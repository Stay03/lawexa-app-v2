import {
  isEventMessage,
  isToolMessage,
  isHandoverMessage,
  type ToolMessage,
  type HandoverMessage,
} from '@/types/chat';
import type { EngineMessage } from '@/v2/runtime/chat-engine';

/**
 * Message grouping (ported verbatim from v1's `groupMessages`). Consecutive tool
 * calls collapse into one animated chain; a handover plus the tool calls it spawns
 * become a handover group; everything else is a single row.
 *
 * Pure and cheap. It is NOT itself the mechanism that keeps tokens off the list —
 * that comes from the engine (token deltas bypass React entirely, flowing through
 * the per-row `useStreamingText` stores, never `setMessages`), which keeps the
 * messages array reference stable during a stream. MessageList calls this inside a
 * `useMemo` keyed on that reference, so it recomputes ONLY on a structural change;
 * on a token flush (or an unrelated re-render) the memo returns the same group
 * objects and the memoized rows hold.
 */
export type MessageGroup =
  | { type: 'single'; message: EngineMessage }
  | { type: 'tool-chain'; messages: ToolMessage[] }
  | { type: 'handover-group'; handover: HandoverMessage; toolMessages: ToolMessage[] };

export function groupMessages(messages: readonly EngineMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (isHandoverMessage(msg)) {
      const toolMessages: ToolMessage[] = [];
      i += 1;
      while (i < messages.length && isToolMessage(messages[i])) {
        toolMessages.push(messages[i] as ToolMessage);
        i += 1;
      }
      groups.push({ type: 'handover-group', handover: msg, toolMessages });
    } else if (isToolMessage(msg)) {
      const toolMessages: ToolMessage[] = [msg];
      i += 1;
      while (i < messages.length && isToolMessage(messages[i])) {
        toolMessages.push(messages[i] as ToolMessage);
        i += 1;
      }
      groups.push({ type: 'tool-chain', messages: toolMessages });
    } else {
      groups.push({ type: 'single', message: msg });
      i += 1;
    }
  }

  return groups;
}

/**
 * A group that is a quiet line beside the turns (the draft "edited" line;
 * Stay, 30 October 2026, 02:16Z, thread 1e44eb39), never a question or an answer.
 */
export function isLineGroup(group: MessageGroup): boolean {
  return group.type === 'single' && isEventMessage(group.message);
}

/**
 * The last group that is a turn, `-1` when there is none: the answer being
 * written, "Ask again" and the working row all read this one, so a line under
 * the last answer changes none of them.
 */
/**
 * The last question's group, or -1 before any: the groups after it are the
 * chat's last answer (Lawexa's machine hand-over shows its full button only
 * there, Userbox v1).
 */
export function lastQuestionGroupIndex(groups: readonly MessageGroup[]): number {
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i];
    if (group.type === 'single' && group.message.role === 'user') return i;
  }
  return -1;
}

export function lastTurnGroupIndex(groups: readonly MessageGroup[]): number {
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (!isLineGroup(groups[i])) return i;
  }
  return -1;
}

/**
 * Where each question's turn ends: the group index after which the agents
 * Lawexa messaged in that turn are drawn (C1, 12 November 2026), mapped to
 * the id of the message that began the turn. A turn runs from its start to
 * the group before the next start or line, or to the end. A question starts
 * one, and so does Lawexa's return (`background_job_result`): the turn it
 * wakes can message an agent too, and the server names the return's id as
 * that call's (the C1 stack run, 12 November 2026: Lawexa called Expert again
 * from its return, and the row had nowhere to go). A question not saved yet
 * has called no agent and has no place.
 */
export function turnEndPlaces(
  groups: readonly MessageGroup[],
  savedIdOf: (message: EngineMessage) => number | null,
): ReadonlyMap<number, number> {
  const places = new Map<number, number>();
  let open: number | null = null;
  let last = -1;
  const close = () => {
    if (open !== null && last !== -1) places.set(last, open);
    open = null;
  };
  groups.forEach((group, index) => {
    const message = group.type === 'single' ? group.message : null;
    const isQuestion = message !== null && message.role === 'user';
    const isReturn = message !== null && isEventMessage(message) && message.eventType === 'background_job_result';
    if (isQuestion || isLineGroup(group)) close();
    if (isQuestion) open = savedIdOf(message);
    else if (isReturn) open = message.serverId;
    last = index;
  });
  close();
  return places;
}
