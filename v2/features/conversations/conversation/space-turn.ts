import type {
  ChatMessage,
  ConversationData,
  ConversationStatusData,
  ConversationTurnUser,
} from '@/types/chat';
import type { SendRefusal, TurnOrigin } from '@/v2/runtime/chat-engine';
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
 * In a space chat the reader's own questions sit on the right and everyone
 * else's on the left under their name (Arthur's layout, 14 October 2026). The
 * sides are drawn only on a record that carries the B4 fields, so an app ahead
 * of the deploy never puts a colleague's question on the reader's side.
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

/** What the side rules read from a user turn. */
type TurnFields = Pick<ChatMessage, 'author' | 'drawnHere'>;

/**
 * Whether a user turn is the reader's own: theirs by id, or the row this
 * client drew itself ({@link ChatMessage.drawnHere}). Nothing else is assumed
 * to be: a withheld writer (`null`) and a row without the `author` key (an
 * older cached page, a resource that leaves the field out) are not the
 * reader's (techlead, 14 October 2026).
 */
export function isOwnTurn(turn: TurnFields, viewerId: number | null): boolean {
  if (turn.drawnHere) return true;
  const author = turn.author;
  return author != null && viewerId !== null && author.id === viewerId;
}

/** Which side of a space chat a question sits on (Arthur's layout, 14 October
 *  2026): the reader's own on the right, everyone else's on the left. */
export type TurnSide = 'mine' | 'theirs';

/** The side of a user turn: mine only when {@link isOwnTurn} says so (the
 *  reader's id, or the row this client drew itself). */
export function turnSide(turn: TurnFields, viewerId: number | null): TurnSide {
  return isOwnTurn(turn, viewerId) ? 'mine' : 'theirs';
}

/** How often an open space chat reads its status: one small request every
 *  four seconds, and none while it streams or its tab is hidden (T6). */
export const SPACE_CHAT_POLL_MS = 4000;

/** When a running turn started, as the activity row's clock reads it (epoch
 *  ms), from the status's or the 409's `pending_since`; null when unknown. */
export function turnStart(pendingSince: string | null | undefined): number | null {
  if (!pendingSince) return null;
  const at = Date.parse(pendingSince);
  return Number.isNaN(at) ? null : at;
}

/**
 * The name a held turn goes by when the server names nobody (a 409 whose
 * sender is not yet known, or a send that met a stream already live): the
 * turn is still a colleague's, so Send is held and there is no Stop, and the
 * row reads "Someone is asking", as the refusal's sentence does.
 */
export const UNNAMED_ASKER = 'Someone';

/** The held Send's accessible name: whose answer it waits for. */
export function heldSendLabel(name: string): string {
  return name === UNNAMED_ASKER ? 'Wait for the answer' : `Wait for ${name}’s answer`;
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

/**
 * The composer's sentence for a refused "Ask again". Its question is already
 * on screen and nothing was typed, so the sentence says when to ask again
 * instead of promising a kept message. A refusal by role reads as for a send.
 */
export function askAgainRefusal(refusal: SendRefusal, viewerId: number | null): string {
  if (refusal.kind === 'forbidden') return VIEW_ONLY_COPY.viewer;
  if (refusal.by === null) return 'Someone is asking right now. Ask again once the answer is in.';
  if (refusal.by.id === viewerId) return 'Your last question is still being answered.';
  return `${refusal.by.name} is asking right now. Ask again once their answer is in.`;
}

/** The draft a refused follow-up leaves in the composer: the follow-up when the
 *  box is empty, else after what the reader typed, a blank line between, so
 *  neither is lost. */
export function draftWithRefused(current: string, refusedText: string): string {
  return current.trim() === '' ? refusedText : `${current}\n\n${refusedText}`;
}

/** The activity row's words while whose turn it is is not known yet: the
 *  status read has not landed. No name, and not "your request". */
export const UNKNOWN_TURN_LABEL = 'Working on an answer';

/** Whose turn is streaming, as the screen shows it. */
export type WhoseTurn =
  /** Nothing streams. */
  | { kind: 'idle' }
  /** The reader's own turn; Stop when they may cancel it. */
  | { kind: 'own'; canStop: boolean }
  /** A colleague's: Send held, the name (or {@link UNNAMED_ASKER}), no Stop. */
  | { kind: 'colleague'; name: string; since: number | null }
  /** Not known yet: Send held, no name, no Stop, until the status read lands. */
  | { kind: 'unknown'; since: number | null };

/**
 * Whose running turn this is (Spaces F4). It reads only what the turn itself
 * carries, never the conversation record, so it answers the same whatever
 * order the record, the attach and the status read arrive in:
 *  1. A turn this engine started is the reader's (`origin: 'own'`), with Stop.
 *  2. A pending status says the rest. `can_cancel` true is the sender reading
 *     (B4: cancel is the sender's alone), so the reader's own, with Stop. A
 *     named sender who is not the reader is a colleague; an unnamed one is an
 *     unnamed colleague. A status with neither field is a server before B4,
 *     where every turn is the owner's own, as before.
 *  3. With no status read, a 409's named sender says whose it is.
 *  4. Otherwise it is not known yet: no Stop, no name.
 */
export function whoseTurn(input: {
  isStreaming: boolean;
  origin: TurnOrigin;
  status: Pick<ConversationStatusData, 'status' | 'execution_user' | 'can_cancel' | 'pending_since'> | null;
  refusal: { by: ConversationTurnUser | null; since: string | null } | null;
  viewerId: number | null;
}): WhoseTurn {
  const { isStreaming, origin, status, refusal, viewerId } = input;
  if (!isStreaming) return { kind: 'idle' };
  if (origin === 'own') return { kind: 'own', canStop: true };
  if (status !== null && status.status === 'pending') {
    if (status.can_cancel === undefined && status.execution_user === undefined) {
      return { kind: 'own', canStop: true };
    }
    if (status.can_cancel === true) return { kind: 'own', canStop: true };
    const sender = status.execution_user ?? null;
    if (sender !== null && sender.id === viewerId) return { kind: 'own', canStop: false };
    return {
      kind: 'colleague',
      name: sender?.name ?? UNNAMED_ASKER,
      since: turnStart(status.pending_since),
    };
  }
  if (refusal !== null && refusal.by !== null && refusal.by.id !== viewerId) {
    return { kind: 'colleague', name: refusal.by.name, since: turnStart(refusal.since) };
  }
  return { kind: 'unknown', since: turnStart(refusal?.since) };
}
