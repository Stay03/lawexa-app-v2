import type { ConversationAuthor, ConversationData } from '@/types/chat';

/**
 * space-turn — the pure rules of a chat in a space (Spaces F4, backend B4
 * bd76241 and 1135730): who may send, why a reader may not, and the words
 * each answer is shown with. No JSX and no hooks, so the screen, the case
 * dock and the tests read the same answers.
 *
 * ── THE SERVER DECIDES WHO SENDS ───────────────────────────────────────────
 * B4 lets the chat's owner and any Owner or Contributor of the chat's space
 * continue it, and answers `can_send` on the record for the reader. It
 * already counts ownership (a chat's owner who is a Viewer of its space may
 * still send), so the composer follows `can_send` alone. A record without the
 * field comes from a server before B4, where only the owner could send.
 *
 * ── WHO ASKED ──────────────────────────────────────────────────────────────
 * Every user turn in a space chat names its writer above the bubble. Labels
 * are drawn only on a record that carries the B4 fields, so an app ahead of
 * the deploy never prints "You" on a colleague's question.
 */

/** The two fields of a conversation record these rules read. */
type SendFields = Pick<ConversationData, 'can_send' | 'my_space_role'>;

/** Whether the reader may send in this chat: the server's answer when it
 *  gave one, else ownership (a server before B4). */
export function canSendIn(detail: SendFields, isOwner: boolean): boolean {
  return typeof detail.can_send === 'boolean' ? detail.can_send : isOwner;
}

/** Why a reader who may not send reads the chat only. */
export type ViewOnlyReason = 'viewer' | 'shared';

/**
 * The reason the view-only pill gives. A space's Viewer is told who may
 * continue; anyone else (a shared link, a server before B4) is told the chat
 * was shared with them. The space role alone does not decide it: a Viewer who
 * owns the chat may send (B10), so `viewer` also needs `can_send` false.
 */
export function viewOnlyReason(detail: SendFields | null): ViewOnlyReason {
  return detail !== null && detail.can_send === false && detail.my_space_role === 'viewer'
    ? 'viewer'
    : 'shared';
}

/** The view-only pill's words: its title over the reason. */
export const VIEW_ONLY_COPY = {
  title: 'View only',
  viewer: 'Only the Owner and Contributors can continue this conversation.',
  shared: 'This conversation was shared with you.',
} as const satisfies { title: string } & Record<ViewOnlyReason, string>;

/**
 * Whether the record carries the B4 fields: only then are the user turns'
 * writers known, so only then are they labelled.
 */
export function hasSpaceContract(detail: SendFields | null): boolean {
  return detail !== null && typeof detail.can_send === 'boolean';
}

/** The line above a user turn: what it shows, what a screen reader says, and
 *  the face beside it (a colleague's; "You" needs none). */
export interface AuthorLine {
  label: string;
  spoken: string;
  person: ConversationAuthor | null;
}

/**
 * Who asked a user turn. The reader's own turn is "You", and so is a turn
 * with no `author` key, which only this client draws (its optimistic row; the
 * server sends the key on every row since B4). A `null` author is a writer
 * the server withheld from a stranger reading a published chat: no label, so
 * nobody else's question can read as "You".
 */
export function authorLine(
  author: ConversationAuthor | null | undefined,
  viewerId: number | null,
): AuthorLine | null {
  if (author === null) return null;
  if (author === undefined || (viewerId !== null && author.id === viewerId)) {
    return { label: 'You', spoken: 'Asked by you', person: null };
  }
  return { label: author.name, spoken: `Asked by ${author.name}`, person: author };
}
