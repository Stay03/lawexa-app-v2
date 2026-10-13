import type {
  ConversationAuthor,
  ConversationData,
  ConversationStatusData,
  ConversationTurnUser,
} from '@/types/chat';
import type { SendRefusal } from '@/v2/runtime/chat-engine';
import { statusOf } from '@/v2/runtime/persist/policy';

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
 *
 * ── WHOSE TURN IS RUNNING ──────────────────────────────────────────────────
 * B4 has no push channel, so an open space chat reads its status every
 * {@link SPACE_CHAT_POLL_MS} while it is visible and nothing streams. The
 * status names the latest sender (`execution_user`) and keeps naming them
 * after the turn ends, so "{name} is asking" is shown only while the status
 * is `pending` (backend B3 answer). A turn that began and ended between two
 * reads moves `last_message_id`, `execution_id` or `pending_since`.
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
  if (author === undefined || isOwnTurn(author, viewerId)) {
    return { label: 'You', spoken: 'Asked by you', person: null };
  }
  return { label: author.name, spoken: `Asked by ${author.name}`, person: author };
}

/** Whether a user turn is the reader's own: theirs by id, or drawn by this
 *  client (no `author` key). A withheld writer (`null`) is never assumed to be. */
export function isOwnTurn(
  author: ConversationAuthor | null | undefined,
  viewerId: number | null,
): boolean {
  if (author === undefined) return true;
  return author !== null && viewerId !== null && author.id === viewerId;
}

/** How often an open space chat reads its status: one small request every
 *  four seconds, and none while it streams or its tab is hidden (T6). */
export const SPACE_CHAT_POLL_MS = 4000;

/**
 * The member whose turn is running, when it is someone else's: `null` unless
 * the status is `pending` with a sender who is not the reader. The status
 * keeps the last sender after a turn ends, so `pending` is checked first.
 */
export function turnHeldBy(
  status: Pick<ConversationStatusData, 'status' | 'execution_user'> | null,
  viewerId: number | null,
): ConversationTurnUser | null {
  if (status === null || status.status !== 'pending') return null;
  const sender = status.execution_user ?? null;
  if (sender === null || sender.id === viewerId) return null;
  return sender;
}

/** The activity row's words while a colleague's turn runs. The orb and the
 *  elapsed clock beside it already say it is ongoing, so no dots. */
export function askingLabel(name: string): string {
  return `${name} is asking`;
}

/** The three fields that move when a turn begins (backend B5 answer, and
 *  `last_message_id` from 1135730). */
type TurnMarks = Pick<ConversationStatusData, 'execution_id' | 'pending_since' | 'last_message_id'>;

/** Whether a turn began between two status reads, even one that also ended
 *  between them: then the transcript is read again. */
export function turnChanged(previous: TurnMarks, next: TurnMarks): boolean {
  return (
    previous.execution_id !== next.execution_id ||
    previous.pending_since !== next.pending_since ||
    previous.last_message_id !== next.last_message_id
  );
}

/** A status read the server refused (403, 404): the reader left the space or
 *  the chat left it, so the poll stops and the transcript is read again,
 *  whose own refusal shows "not available" (gone.ts). */
export function stopsPolling(error: unknown): boolean {
  const status = statusOf(error);
  return status === 403 || status === 404;
}

/** A send the server would not take, as the composer shows it: the sentence
 *  in its banner, with the message given back to the pill. */
export interface SendRefused {
  refused: string;
}

/**
 * The composer's sentence for a refused send. Another member's turn: their
 * name, and that the message is kept. The reader's own earlier turn (another
 * tab or device): that it is still being answered. A refusal by role: the
 * view-only pill's own reason, since the pill replaces the composer next.
 */
export function sendRefusal(refusal: SendRefusal, viewerId: number | null): string {
  if (refusal.kind === 'forbidden') return VIEW_ONLY_COPY.viewer;
  if (refusal.by === null) return 'Someone is asking right now. Your message is kept.';
  if (refusal.by.id === viewerId) {
    return 'Your last question is still being answered. Your message is kept.';
  }
  return `${refusal.by.name} is asking right now. Your message is kept.`;
}

/** The draft a refused follow-up leaves in the composer: the follow-up when the
 *  box is empty, else after what the reader typed, a blank line between, so
 *  neither is lost. */
export function draftWithRefused(current: string, refusedText: string): string {
  return current.trim() === '' ? refusedText : `${current}\n\n${refusedText}`;
}
