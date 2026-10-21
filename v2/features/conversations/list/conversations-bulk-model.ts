import type { ConversationListItem } from '@/types/chat';

/**
 * The chats list's bulk actions for what is ticked (Arthur, 20 October 2026:
 * "keep the actions context-specific"). Pure, so the rule is pinned by a test
 * and the bar only draws what it says.
 *
 *   a ticked chat may move           move to a space
 *   a ticked chat is shared by link  make private
 *   a ticked chat may be deleted     delete
 *
 * Each follows the row's own `can` (and `is_private`), the same answer its
 * "…" menu reads, so the bar never offers what every ticked row's menu would
 * refuse. With nothing ticked every action shows, off.
 */
export type ConversationsBulkAction = 'space' | 'make_private' | 'delete';

type Row = Pick<ConversationListItem, 'can' | 'is_private'>;

export function conversationsBulkActions(ticked: readonly Row[]): ConversationsBulkAction[] {
  const none = ticked.length === 0;
  const actions: ConversationsBulkAction[] = [];
  if (none || ticked.some((row) => row.can?.move_to_space === true || row.can?.move === true)) actions.push('space');
  if (none || ticked.some((row) => row.is_private === false)) actions.push('make_private');
  if (none || ticked.some((row) => row.can?.delete === true)) actions.push('delete');
  return actions;
}

/**
 * A row can be ticked unless it is confidential: its only copy is on this
 * device, so no server action can reach it (the open chat's banner owns its
 * delete, and the server refuses it a Space).
 */
export function isBulkSelectable(row: Pick<ConversationListItem, 'is_confidential'>): boolean {
  return row.is_confidential !== true;
}
