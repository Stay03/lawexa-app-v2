/**
 * draft-flush — every open draft editor's "save what is typed now", so a
 * message is sent only after the draft's last edits reach the server
 * (drafts saved as notes, thread 1e44eb39). Lawexa reads the draft's note
 * when it builds the next answer; the autosave waits 1.5 s after the last
 * keystroke, so without this a quick send would beat the save and Lawexa
 * would miss the last words typed.
 *
 * An editor registers a flusher while it edits a note, keyed by chat and
 * draft. A flusher saves now and settles `true` once everything typed is on
 * the server, `false` if the save failed. The send waits for every flusher
 * of its chat, but never longer than `SEND_FLUSH_LIMIT_MS`: a slow network
 * must not hold a message back. A failed or late save sends anyway and says
 * so in a toast, since the composer may be the chat's, the dock's or the
 * case page's; the panel keeps its own Retry.
 *
 * Used by every way a turn starts (useConversationController.ts): a send, a
 * card's follow-up (both through `submit`) and Ask again.
 */

export type DraftFlusher = () => Promise<boolean>;

export type DraftFlushOutcome =
  /** Nothing open was editing a note, or everything typed was saved. */
  | 'saved'
  /** A save failed, or did not finish in time: Lawexa may not see the last edits. */
  | 'unsaved';

/** The longest a send waits for the drafts' saves. */
export const SEND_FLUSH_LIMIT_MS = 3_000;

const flushers = new Map<string, Map<number, DraftFlusher>>();

/** Register draft `ordinal`'s flusher while it edits; the returned function unregisters it. */
export function registerDraftFlush(conversationId: string, ordinal: number, flusher: DraftFlusher): () => void {
  let chat = flushers.get(conversationId);
  if (!chat) {
    chat = new Map();
    flushers.set(conversationId, chat);
  }
  chat.set(ordinal, flusher);
  return () => {
    const current = flushers.get(conversationId);
    if (current?.get(ordinal) !== flusher) return;
    current.delete(ordinal);
    if (current.size === 0) flushers.delete(conversationId);
  };
}

/** Save every open draft of this chat before a message goes; waits at most `limitMs`. */
export async function flushDraftsBeforeSend(
  conversationId: string,
  limitMs: number = SEND_FLUSH_LIMIT_MS,
): Promise<DraftFlushOutcome> {
  const chat = flushers.get(conversationId);
  if (!chat || chat.size === 0) return 'saved';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), limitMs);
  });
  const saves = [...chat.values()].map((flusher) => flusher().catch(() => false));
  try {
    const all = await Promise.race([Promise.all(saves).then((results) => results.every(Boolean)), late]);
    return all ? 'saved' : 'unsaved';
  } finally {
    clearTimeout(timer);
  }
}

/** What a send whose draft edits did not all save says. */
export const UNSAVED_DRAFT_LINE = 'Your last draft edits weren’t saved, so Lawexa may not see them.';
