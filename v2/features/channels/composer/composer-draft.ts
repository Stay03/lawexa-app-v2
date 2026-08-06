'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { channelFilesApi } from '@/lib/api/collab';
import type { ChannelFile, MessageReplyTo } from '@/types/collab';
import {
  deviceKey,
  parseMessageReplyTo,
  readStored,
  removeStored,
  stampRecord,
  writeStored,
} from '../device-store';

/**
 * composer-draft — what a half-written channel message is, where it lives while
 * the tab is shut, and what has to be TRUE again before it can be sent.
 * 2026-08-06, after the owner lost a long message to a closed tab.
 *
 * ── ONE IDEA OF A DRAFT, NOT TWO ───────────────────────────────────────────
 * The AI chat already answered this (`v2/features/conversations/conversation/
 * ConversationComposer.tsx`): a per-scope `localStorage` record, restored by a
 * lazy `useState` initialiser, and the key REMOVED rather than left holding an
 * empty string. This is the same shape with the same rules; what it adds is the
 * two things a channel message has and a prompt does not — a reply target and
 * staged files — plus the account scoping neither had.
 *
 * ── WHAT IS KEPT, AND WHY THAT MUCH ────────────────────────────────────────
 *  - THE TEXT, verbatim. It is the whole complaint.
 *  - THE REPLY, as the `MessageReplyTo` QUOTE rather than a uuid. The uuid is
 *    all the wire needs, but the composer also has to draw "Replying to Ada —
 *    …" and hand the optimistic row its quote, and there is no
 *    `GET /messages/{uuid}` to rebuild either from. The quote is the smallest
 *    self-sufficient record: restoring it needs no request and no transcript,
 *    so a draft written five pages up the history still comes back as a reply.
 *  - THE FILES, as `{id, name, size}` — enough to DRAW the chip, never enough
 *    to send it. The server's `url` is signed for about an hour, so a stored
 *    one is a picture that quietly breaks; the id is re-checked against the
 *    library and the LIVE row is what a send is built from. See
 *    {@link useDraftFileCheck}.
 *
 * Nothing else is kept. The in-flight uploads are not a draft (there is no file
 * on disk to resume from), and the mention picker's open state is not a fact
 * about the message.
 *
 * ── A DRAFT BELONGS TO AN ACCOUNT ──────────────────────────────────────────
 * The key carries the server-verified viewer id, so on a shared computer B's
 * composer cannot read A's key at all, and `forgetOtherOwners` takes A's words
 * off the device the first time the v2 layout sees a different account —
 * whatever B opens, including nothing at all (`../device-sweep.tsx`). A
 * signed-out reader gets no draft in either direction: they cannot post, so the
 * only thing persistence could do for them is leave a private sentence on
 * someone else's machine.
 *
 * ── AND IT DOES NOT LIVE FOREVER ───────────────────────────────────────────
 * One key per channel per account, each able to hold a whole 8000-character
 * message, kept until it is sent — that is unbounded storage in a quota this
 * origin SHARES with v1, and a full quota makes every write throw, which
 * `writeStored` swallows by design. Draft saving would then be broken
 * permanently and silently: the exact failure this feature exists to prevent.
 * So every record is stamped (`stampRecord`) and the sweep drops it 30 days
 * after its last write. Thirty days is far past any session and far short of
 * forever; a draft nobody has touched in a month is not a message anybody is
 * still writing.
 *
 * ── THE WRITE IS DEBOUNCED, AND FLUSHED ON `pagehide` ──────────────────────
 * The composer writes on a timer rather than on every keystroke (a stringify
 * plus a synchronous `localStorage` write per character), and flushes the
 * pending one when the page goes away or the composer unmounts. Both halves are
 * required: a debounce alone would drop the tail of a message to the exact
 * event — a closing tab — this whole feature exists for. The AI chat's precedent
 * writes a bare string and can afford to skip both; this record cannot.
 */

/** One file a draft was holding. Enough to draw the chip; never enough to send. */
export interface DraftAttachment {
  readonly id: number;
  readonly name: string;
  readonly size: number;
}

/** The message a reader had half-written when the tab closed. */
export interface ChannelDraft {
  readonly text: string;
  readonly reply: MessageReplyTo | null;
  readonly attachments: readonly DraftAttachment[];
}

/** Nothing to restore — a frozen empty so callers can compare by reference. */
const NO_ATTACHMENTS: readonly DraftAttachment[] = [];

function draftKey(ownerId: number, channelUuid: string): string {
  return deviceKey('draft', ownerId, channelUuid);
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

function parseAttachment(raw: unknown): DraftAttachment | null {
  if (!isRecord(raw)) return null;
  const { id, name, size } = raw;
  if (typeof id !== 'number' || !Number.isFinite(id)) return null;
  if (typeof name !== 'string') return null;
  if (typeof size !== 'number' || !Number.isFinite(size)) return null;
  return { id, name, size };
}

/**
 * The saved draft for this reader in this channel, or `null` when there is
 * none — including when there is no account to scope it to.
 *
 * A record that parses to nothing at all (no words, no reply, no files) answers
 * `null` too: it is indistinguishable from having never written anything, and
 * a caller with a `ChannelDraft` in hand should be able to trust it has
 * something in it.
 */
export function readChannelDraft(
  ownerId: number | null,
  channelUuid: string,
): ChannelDraft | null {
  if (ownerId === null) return null;
  const raw = readStored(draftKey(ownerId, channelUuid));
  if (!isRecord(raw)) return null;

  const text = typeof raw.text === 'string' ? raw.text : '';
  // A QUOTE WE CANNOT READ IS A DRAFT WITH NO REPLY, NOT A LOST DRAFT. The
  // words are the thing worth saving; losing them because a nested field of the
  // quote changed shape between deploys would be the wrong trade by far.
  const reply = raw.reply === undefined || raw.reply === null
    ? null
    : parseMessageReplyTo(raw.reply);
  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
        .map(parseAttachment)
        .filter((entry): entry is DraftAttachment => entry !== null)
    : NO_ATTACHMENTS;

  if (text === '' && reply === null && attachments.length === 0) return null;
  return { text, reply, attachments };
}

/**
 * Mirror the composer's armed state to the device — or remove the key when
 * there is nothing armed, so an emptied composer leaves nothing behind (the AI
 * chat's rule; a stored `""` is a draft that says it exists).
 *
 * STAMPED, so the record can expire. Every write re-stamps, which is what makes
 * the 30 days "since you last touched it" rather than "since you started it".
 */
export function saveChannelDraft(
  ownerId: number | null,
  channelUuid: string,
  draft: ChannelDraft,
): void {
  if (ownerId === null) return;
  const key = draftKey(ownerId, channelUuid);
  if (draft.text === '' && draft.reply === null && draft.attachments.length === 0) {
    removeStored(key);
    return;
  }
  writeStored(key, stampRecord(draft));
}

/* ── Making a restored file trustworthy ───────────────────────────────────── */

/**
 * What became of the files a draft was holding.
 *
 * `checking` is the honest third state and the composer BLOCKS SEND on it:
 * posting before the answer arrives would post the caption without the files
 * the reader can see chips for, which is the exact failure the attachment work
 * exists to end.
 */
export interface DraftFileCheck {
  /** Still asking. Nothing may be sent yet. */
  readonly checking: boolean;
  /** The LIVE library rows for the draft's ids, in the order they were staged. */
  readonly present: readonly ChannelFile[];
  /** Ids the library no longer has — named, so the notice can say which. */
  readonly missing: readonly DraftAttachment[];
  /** The check could not be made at all (offline, 403 after losing access). */
  readonly failed: boolean;
}

const NO_FILES: readonly ChannelFile[] = [];
const IDLE: DraftFileCheck = {
  checking: false,
  present: NO_FILES,
  missing: NO_ATTACHMENTS,
  failed: false,
};

/**
 * Find the library rows for a set of ids.
 *
 * THE INDEX IS THE ONLY WAY TO ASK. There is no `GET /channels/{uuid}/files/
 * {id}`, so "is this id still there?" is answered by walking the index — which
 * stops the moment every id is accounted for. That is page one in practice
 * (the index is newest-first and these files were uploaded shortly before the
 * tab closed); the loop exists so a big library cannot make us call a file
 * missing that is merely on page two.
 *
 * WHICH IS WHY IT TAKES THE QUERY'S `signal`. A loop is not one request: leaving
 * the channel while it is on page two would otherwise keep walking a library
 * this reader has already left, and land its answer in a cache entry nobody is
 * observing. The signal is checked between pages and the abort is thrown, which
 * is what TanStack reads as a cancellation. `channelFilesApi.getList` takes no
 * signal of its own (it is the shared v1 client), so the request in flight when
 * the reader leaves does finish — the WALK is what stops, and that is the part
 * that is unbounded.
 */
async function findChannelFiles(
  channelUuid: string,
  ids: readonly number[],
  signal: AbortSignal,
): Promise<ReadonlyMap<number, ChannelFile>> {
  const wanted = new Set(ids);
  const found = new Map<number, ChannelFile>();
  let page = 1;
  for (;;) {
    signal.throwIfAborted();
    const response = await channelFilesApi.getList(channelUuid, { per_page: 100, page });
    for (const file of response.data) {
      if (wanted.has(file.id)) found.set(file.id, file);
    }
    if (found.size === wanted.size) break;
    if (page >= response.pagination.last_page) break;
    page += 1;
  }
  return found;
}

/**
 * Re-check a restored draft's files against the channel's library.
 *
 * A chip restored from disk is a CLAIM about the server, and between the tab
 * closing and this moment anyone with access could have deleted the file —
 * `../removed-files.ts` covers the same loss while the tab is OPEN, and this is
 * the closed half of it. Sending an id the server no longer has costs the
 * reader their message and their caption for a 422 nobody can read, so the id
 * is verified before it is ever armed.
 *
 * Its own key family, deliberately NOT under `channelsQueries.filesOf()`: the
 * realtime file writers fan over that prefix with `ChannelFileListResponse`
 * shapes, and this entry is a map.
 *
 * ONE RETRY, not the default three. The reader is looking at chips they cannot
 * send yet, so seven seconds of exponential backoff is worse than saying so.
 *
 * `networkMode: 'always'`, AND IT IS THE MOST IMPORTANT LINE HERE. The v2
 * QueryClient sets no `networkMode`, so TanStack's default `'online'` applies —
 * and offline that does not FAIL a query, it PAUSES it: `status` stays
 * `pending`, `isError` stays false, and nothing ever settles. `checking` would
 * then be true for as long as the device is offline, and `checking` blocks Send
 * for the WHOLE message, words and all. A reader on a train would be holding a
 * composer that refuses to send anything, for a reason no timeout ends. Offline
 * is exactly when the persistence this check guards has to earn its keep, so the
 * check is made to fail instead: `failed` has a designed sentence, keeps the ids
 * on the device for the next reload to re-ask, and lets the message go.
 */
export function useDraftFileCheck(
  channelUuid: string,
  viewerId: number | null,
  attachments: readonly DraftAttachment[],
): DraftFileCheck {
  const ids = useMemo(() => attachments.map((entry) => entry.id), [attachments]);
  const query = useQuery({
    queryKey: [
      'channels',
      'composer-draft-files',
      channelUuid,
      { viewerId },
      ids.join(','),
    ] as const,
    queryFn: ({ signal }) => findChannelFiles(channelUuid, ids, signal),
    enabled: ids.length > 0,
    staleTime: Infinity,
    retry: 1,
    networkMode: 'always',
  });

  const data = query.data;
  const failed = query.isError;
  return useMemo(() => {
    if (ids.length === 0) return IDLE;
    if (failed) {
      return { checking: false, present: NO_FILES, missing: NO_ATTACHMENTS, failed: true };
    }
    if (!data) {
      return { checking: true, present: NO_FILES, missing: NO_ATTACHMENTS, failed: false };
    }
    const present: ChannelFile[] = [];
    const missing: DraftAttachment[] = [];
    for (const entry of attachments) {
      const file = data.get(entry.id);
      if (file) present.push(file);
      else missing.push(entry);
    }
    return { checking: false, present, missing, failed: false };
  }, [attachments, ids, data, failed]);
}
