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

/**
 * Saves still on the wire from an editor that has gone (the panel closed, or
 * moved to another draft): the send waits for them too, since no flusher is
 * left to ask (Frontend's review: close the panel and send at once).
 */
const inFlight = new Map<string, Set<Promise<boolean>>>();

/** Keep an unmounted editor's last save until it settles, so a send waits for it. */
export function trackDraftSave(conversationId: string, settled: Promise<boolean>): void {
  let chat = inFlight.get(conversationId);
  if (!chat) {
    chat = new Set();
    inFlight.set(conversationId, chat);
  }
  chat.add(settled);
  const forget = () => {
    const current = inFlight.get(conversationId);
    current?.delete(settled);
    if (current?.size === 0) inFlight.delete(conversationId);
  };
  settled.then(forget, forget);
}

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
  const open = [...(flushers.get(conversationId)?.values() ?? [])];
  const leaving = [...(inFlight.get(conversationId) ?? [])];
  if (open.length === 0 && leaving.length === 0) return 'saved';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), limitMs);
  });
  const saves = [...open.map((flusher) => flusher().catch(() => false)), ...leaving.map((save) => save.catch(() => false))];
  try {
    const all = await Promise.race([Promise.all(saves).then((results) => results.every(Boolean)), late]);
    return all ? 'saved' : 'unsaved';
  } finally {
    clearTimeout(timer);
  }
}

/** What a send whose draft edits did not all save says. */
export const UNSAVED_DRAFT_LINE = 'Your last draft edits weren’t saved, so Lawexa may not see them.';

/**
 * Drafts whose open editor has been overtaken: Lawexa wrote a newer version
 * into the note, or the panel lost the note, so the editor on the older copy
 * must not send its last edit as it unmounts (it would be made on an older
 * copy and could land on Lawexa's newer one; Frontend's review). The panel
 * marks a draft when it stops editing its note, and clears the mark when it
 * edits it again. The device copy keeps the typing, offered on the new
 * version to copy.
 */
const superseded = new Set<string>();

function placeKey(conversationId: string, ordinal: number, noteId: number): string {
  return `${conversationId}:${ordinal}:${noteId}`;
}

/** Draft `ordinal`'s editor on note `noteId` no longer edits it: its unmount sends nothing. */
export function markDraftSuperseded(conversationId: string, ordinal: number, noteId: number): void {
  superseded.add(placeKey(conversationId, ordinal, noteId));
}

/** Draft `ordinal` edits note `noteId` again (after a restore, a Reload). */
export function clearDraftSuperseded(conversationId: string, ordinal: number, noteId: number): void {
  superseded.delete(placeKey(conversationId, ordinal, noteId));
}

export function isDraftSuperseded(conversationId: string, ordinal: number, noteId: number): boolean {
  return superseded.has(placeKey(conversationId, ordinal, noteId));
}

/**
 * Save everything typed now, and settle `true` once it is saved, `false` on a
 * failure: an editor's flusher. Waits on the saves themselves (`lastSave`,
 * which settles even after the editor unmounts), never on a render. Goes
 * round again while the reader typed on during a save; stops when a save
 * fails, or when the same save comes back (the editor is gone and nothing
 * newer can be sent from it).
 */
export async function saveAllNow(editor: {
  flush: () => void;
  currentStatus: () => string;
  lastSave: () => Promise<boolean> | null;
  stopped: (status: string) => boolean;
}): Promise<boolean> {
  let previous: Promise<boolean> | null = null;
  for (let round = 0; round < 5; round += 1) {
    editor.flush();
    const status = editor.currentStatus();
    if (status === 'clean') return true;
    if (editor.stopped(status)) return false;
    // Typing waiting out a rate-limit hold is not saved, and no save is on its way.
    if (status !== 'saving') return false;
    const save = editor.lastSave();
    if (!save) return false;
    // The same save again: the editor is gone, so its word is final.
    if (save === previous) return save;
    if (!(await save)) return false;
    previous = save;
  }
  return editor.currentStatus() === 'clean';
}
