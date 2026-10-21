import type { ChatError } from '@/types/admin-chat-errors';

/** What a chat error row says about its chat: a link, a reason there is none, or nothing. */
export type ChatErrorChat =
  | { kind: 'link'; href: string }
  | { kind: 'note'; text: string }
  | null;

/**
 * The row's way to the chat (Stay chose A, 21 October 2026). A chat in no
 * Space and no channel opens in the admin chat view. A Space or channel chat
 * 404s there, so the row says why there is no link. A deleted chat says so.
 * A row with no chat at all, or from a server without the fields, says
 * nothing.
 */
export function chatErrorChat(
  error: Pick<ChatError, 'conversation_id' | 'conversation_uuid' | 'admin_viewable' | 'space_id'>,
): ChatErrorChat {
  if (error.conversation_uuid) {
    if (error.admin_viewable) {
      return { kind: 'link', href: `/admin/conversations/${error.conversation_uuid}` };
    }
    if (error.admin_viewable === false) {
      return {
        kind: 'note',
        text:
          error.space_id != null
            ? 'In a Space, not viewable by admin'
            : 'In a channel, not viewable by admin',
      };
    }
    return null;
  }
  if (error.conversation_uuid === null && error.conversation_id != null) {
    return { kind: 'note', text: 'Chat deleted' };
  }
  return null;
}
