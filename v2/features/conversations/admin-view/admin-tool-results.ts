import { adminApi } from '@/lib/api/admin';
import type { AdminConversationView } from '@/types/admin-conversation-view';
import type { ToolResultSource } from '../conversation/tools/tool-result-source';

/**
 * Step results in the admin view, as the owner's chat has them (Stay, thread
 * 085a980c: "like for like"). The admin route sends every result inline, but
 * one over 200 kB comes cut, with `metadata.result_truncated` (Backend
 * aee2efb0). Such a step is drawn as the owner's chat draws a result it left
 * out of the download: opening it fetches the whole result, here from
 * `GET /api/admin/conversations/{uuid}/messages/{id}/result`.
 */
export function adminToolResults(conversationId: string): ToolResultSource {
  return {
    conversationId,
    read: async (id, messageId) => adminApi.getConversationToolResult(id, messageId),
  };
}

/** A cut result becomes one the step fetches when it opens (has a result, no content here). */
export function withCutResultsLeftOut(messages: AdminConversationView['messages']): AdminConversationView['messages'] {
  return messages.map((message) =>
    message.role === 'tool' && (message.metadata as { result_truncated?: unknown } | null)?.result_truncated === true ? { ...message, content: '', has_result: true } : message,
  );
}
