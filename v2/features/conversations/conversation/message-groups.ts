import {
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
