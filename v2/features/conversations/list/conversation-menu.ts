import type { ConversationCan } from '@/types/chat';

/**
 * conversation-menu — what the "…" menu beside a conversation offers, and in
 * what order (Arthur, 15 October 2026, Inside a space). No JSX and no hooks, so
 * the conversations list, a space's Conversations tab and the open chat's
 * header all read the same answer, and the tests pin it without a browser.
 *
 * ── THE SERVER DECIDES, THE MENU FOLLOWS ───────────────────────────────────
 * Every conversation payload carries `can` (backend, 15 October 2026), worked
 * out by the server's own rules for this reader: the chat's owner, a Viewer
 * with their own chat, the space's Owner on a member's chat. An item shows only
 * when its flag is true, so no menu offers what the server would refuse. A
 * payload without `can` (an older server) shows nothing rather than a guess.
 *
 * ── ARTHUR'S TWO LISTS ─────────────────────────────────────────────────────
 *  - Outside a space: Rename, Move to Space, Share, Delete.
 *  - Inside a space:  Rename, Move, Remove, Delete.
 * Delete and Remove each ask first. Delete is last, under a rule.
 *
 * ── NO SHARE INSIDE A SPACE ────────────────────────────────────────────────
 * A chat in a Space is read by the Space's members only and is never public
 * (Arthur's B, 30 October 2026, thread d8d7e2cd; the server refuses with a
 * 422). So the menu offers no Share there, and says why instead
 * ({@link SPACE_CHAT_SHARE_NOTE}), where Share would have been.
 */

export type ConversationMenuItem = 'rename' | 'move_to_space' | 'move' | 'remove' | 'share' | 'delete';

const OUTSIDE_A_SPACE: readonly ConversationMenuItem[] = ['rename', 'move_to_space', 'share', 'delete'];
const INSIDE_A_SPACE: readonly ConversationMenuItem[] = ['rename', 'move', 'remove', 'delete'];

/** The quiet line a Space chat's menu shows where Share was. */
export const SPACE_CHAT_SHARE_NOTE = "Shared with this Space's members only.";

/** Whether a chat's menu says it is shared with the Space only: a chat in a
 *  Space whose reader could otherwise share it. */
export function showsSpaceShareNote(can: ConversationCan | null | undefined, inSpace: boolean): boolean {
  return inSpace && can?.share === true;
}

/** The words each item shows, Arthur's. */
export const CONVERSATION_MENU_LABELS: Readonly<Record<ConversationMenuItem, string>> = {
  rename: 'Rename',
  move_to_space: 'Move to Space',
  move: 'Move',
  remove: 'Remove',
  share: 'Share',
  delete: 'Delete',
};

/** The items this reader gets for a chat, in Arthur's order: his list for where
 *  the chat is, kept to the flags the server set. */
export function conversationMenuItems(
  can: ConversationCan | null | undefined,
  inSpace: boolean,
): ConversationMenuItem[] {
  if (!can) return [];
  return (inSpace ? INSIDE_A_SPACE : OUTSIDE_A_SPACE).filter((item) => can[item] === true);
}

/**
 * How Remove reaches the server. The chat's owner takes their own chat out of
 * the space (`PATCH /conversations/{uuid}` with `space_uuid: null`); the
 * space's Owner takes a member's chat out through the space
 * (`DELETE /spaces/{uuid}/items`). The row's top-level `user_id` tells the two
 * apart (backend: `author` is not on every payload). Either way the chat goes
 * back to its owner and nothing is deleted.
 */
export function conversationRemoveRoute(
  ownerId: number,
  viewerId: number | null,
): 'detach' | 'space-item' {
  return viewerId !== null && ownerId === viewerId ? 'detach' : 'space-item';
}
