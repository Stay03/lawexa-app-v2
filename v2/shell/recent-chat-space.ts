import type { ConversationListItem } from '@/types/chat';

/**
 * The space a recent chat sits in, as the sidebar and the drawer name it under
 * the chat's title (Stay, 15 October 2026: "the recent conversations on the
 * sidebar should have the space at the bottom of the conversation like in the
 * conversation list page"). Null outside a space, and for a confidential chat,
 * whose row names no space (ConversationRow does the same).
 */
export function recentSpaceName(conversation: Pick<ConversationListItem, 'is_confidential' | 'space'>): string | null {
  return conversation.is_confidential ? null : (conversation.space?.name ?? null);
}
