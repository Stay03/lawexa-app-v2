import type { ToolMessage } from '@/types/chat';

/* "Earlier reading summarised" (Stay, 16 November 2026; Backend's shapes). A long
 * reply that nears the model's limit has what it read so far summarised, and
 * keeps going. Lawexa may then read something again, which looks odd without a
 * word, so the chat's steps show one quiet line where it happened: live from the
 * `context_compacted` event, and from the stored row of the same name when the
 * chat is opened again. It is a step like the tools' (the chain draws it), done
 * the moment it appears, with no result to fetch. */

export const CONTEXT_COMPACTED_STEP = 'context_compacted';
export const COMPACTED_LABEL = 'Earlier reading summarised';
export const COMPACTED_DETAIL =
  'This reply had read a lot, so Lawexa summarised what it read earlier to keep going. If it needs something again, it reads it again.';

export function compactedStep(id: string, timestamp: Date, agentSlug?: string | null): ToolMessage {
  return {
    id,
    role: 'tool',
    content: COMPACTED_LABEL,
    timestamp,
    toolName: CONTEXT_COMPACTED_STEP,
    toolParameters: {},
    toolStatus: 'complete',
    toolResult: { success: true, data: null, error: null },
    ...(agentSlug ? { agentSlug } : {}),
  };
}
