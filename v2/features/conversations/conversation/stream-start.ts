import { isToolMessage, isHandoverMessage } from '@/types/chat';
import type { EngineMessage } from '@/v2/runtime/chat-engine';

/**
 * When the running turn's work began, for the working row's timer: the turn's
 * first tool/handover start, else its streaming placeholder — pure.
 *
 * Only the messages after the user's last message count. Earlier turns' tool
 * calls are still in the list, and timing from the first of them made a
 * follow-up sent after a pause read as minutes of work (a quiz marked in about
 * 6 s showed "6m 45s", Sep 27).
 */
export function computeStreamStart(messages: readonly EngineMessage[]): number | null {
  let turnStart = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      turnStart = i + 1;
      break;
    }
  }
  const turn = messages.slice(turnStart);
  for (const m of turn) {
    if (isToolMessage(m) || isHandoverMessage(m)) return m.timestamp.getTime();
  }
  for (const m of turn) {
    if (m.role === 'assistant' && m.isStreaming) return m.timestamp.getTime();
  }
  return null;
}
