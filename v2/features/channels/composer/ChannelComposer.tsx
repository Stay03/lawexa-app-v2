'use client';

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AtSign,
  CornerUpLeft,
  Paperclip,
  SendHorizontal,
  Smile,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { extractApiError } from '@/lib/utils/api-error';
import { formatBytes } from '@/lib/utils/format-bytes';
import type {
  Channel,
  ChannelFile,
  Message,
  MessageAttachment,
  MessageReplyTo,
} from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { isRenderableImage } from '../files/file-model';
import { useUploadChannelFile } from '../lists-files-mutations';
import { useSendChannelMessage } from '../message-mutations';
import {
  buildMentionOptions,
  FILE_ACCEPT_ATTR,
  filesFromClipboard,
  MAX_MESSAGE_ATTACHMENTS,
  MESSAGE_MAX_LENGTH,
  messagePreviewText,
  REACTION_TRAY,
  untaggableSentence,
  validateChannelFile,
  type MentionCandidate,
} from '../model';
import { channelsQueries } from '../queries';
import { useRemovedChannelFiles } from '../removed-files';
import { MemberAvatar, LawexaAvatar } from '../ui/avatars';
import type { TypingUser } from '../room';
import { useHeldValue } from '../use-held-value';
import {
  ChatComposerShell,
  ComposerAction,
  ComposerNotice,
  ComposerTrayRow,
  COMPOSER_ACTION,
} from './ChatComposerShell';

/**
 * ChannelComposer — the channel's own composer on {@link ChatComposerShell}:
 * the transcript's column, one rounded surface, and an inner row of
 * attach · mention · emoji · textarea · send. Phase-5 W2, rebuilt in the W2
 * redesign wave (2026-08-05) after the owner's verdict that the shipped one
 * was the AI-chat pill rescaled.
 *
 * SEND is optimistic and NON-BLOCKING: the input clears immediately, the row
 * appears as `sending`, and a failure surfaces ON THE ROW (Retry/Discard —
 * never a rollback, never a toast). The composer never disables while a send
 * is in flight — Discord-fluid, and §5's ladder makes it safe.
 *
 * REPLY (DIRECTION 4): one staged quote bar above the surface, cancel with one
 * tap or Escape; sends `reply_to_uuid` and pre-builds the optimistic row's
 * quote so it renders before the server echoes. The bar collapses with the
 * shared symmetric grid-rows tween and holds its last content through the exit
 * so it never flashes empty.
 *
 * ── ATTACH MEANS ATTACH (backend, 2026-08-05) ──────────────────────────────
 * This affordance shipped before the API could carry a file ON a message, and
 * it did the only thing available: it uploaded to the channel's Files library
 * and posted the text separately. The message showed nothing. That was a bug
 * we shipped, and it is what this half of the composer now fixes — an upload
 * ends as a STAGED attachment here, and the next send carries it
 * (`attachment_ids`, order preserved server-side, max 10).
 *
 * IT IS STILL THE SAME UPLOAD THE FILES SECTION MAKES — ALL THE WAY DOWN. One
 * `POST /channels/{uuid}/files` through the existing `useUploadChannelFile`:
 * same allow-list, same 15MB cap, same cache writer. There is no separate
 * "attachment" storage anywhere in this system; a file is a file, and the one
 * upload puts it in two places at once.
 *
 * A PASTE IS AN ATTACH (owner, 2026-08-05). A screenshot is the commonest thing
 * anyone has on a clipboard, and pasting one here used to do nothing at all —
 * silently, which is the worst way for a thing to not work. It now runs the
 * same `attachFiles` as the paperclip, so a pasted file and a picked one cannot
 * drift. Two details carry it: a clipboard image has NO FILENAME and our
 * pre-check reads the extension off the name, so `filesFromClipboard` names it
 * first (the server sniffs content and does not care what a file is called);
 * and a paste carrying text as well as a picture — a spreadsheet cell, a block
 * of rich text — keeps its text, because breaking ordinary pasting to serve the
 * rarer case would be a bad trade.
 *
 * WHICH IS WHY REMOVING A CHIP CANNOT DELETE ANYTHING, AND THE TRAY SAYS SO.
 * By the time a chip exists the file is already in the channel's library and
 * visible to everyone in the Files section — un-staging it only decides that
 * THIS message will not carry it. Leaving that unsaid would let a reader
 * believe they had taken a file back; so the tray carries one quiet line
 * stating it, with the Files link right there, while anything is staged and
 * never once it isn't. The line replaces the old "it went to Files" notice,
 * which said the same fact at the wrong moment (after an upload, when nothing
 * had been decided yet) and is now simply what staging means.
 *
 * AND WHEN THE FILE ITSELF GOES, THE CHIP GOES WITH IT. A reader who follows
 * that link and deletes the file — or a member who deletes it from the other
 * end of the channel — leaves this composer holding a library row that no
 * longer exists, and Send would post an id the server can only refuse. The
 * removal arrives through `../removed-files.ts` and the chip is dropped BEFORE
 * a send can carry it, rather than being diagnosed afterwards from a 422 that
 * has already cost the reader their message and their caption. It never comes
 * back either: a failed delete rolls the library back, but a chip somebody
 * watched disappear must not reappear on a message they may already have sent.
 * The file is still in the library, so re-attaching is two taps.
 *
 * IT TAKES THE PROGRESS AND THE CANCEL TOO. The hook's object form carries
 * `onProgress` and `signal`, so each in-flight chip shows a determinate
 * percentage and can be called off. The bare-`File` shorthand exists for a
 * caller with nowhere to put either, and this is not one: the same operation
 * must not feel like two different things depending on which end of the screen
 * it was started from. Percent is BYTES ON THE WIRE, never completion — at 100%
 * the server is still storing and sniffing, so the chip stays until the promise
 * settles rather than vanishing at the top of the bar. A cancellation rejects
 * like any other failure, so the composer remembers that it asked and stays
 * silent instead of reporting a problem the reader caused on purpose.
 *
 * EVERY UPLOAD IS ITS OWN PROMISE — `mutateAsync`, NEVER `mutate`. The file
 * input carries `multiple`, so choosing three files at once is an ordinary
 * gesture, and it used to lose two of them. One `useMutation` is ONE observer:
 * TanStack v5 stores the per-call `{onSuccess, onError, onSettled}` ON that
 * observer and OVERWRITES them on the next `mutate()`, detaching the call
 * before it. The hook's own cache writer lives on the MUTATION rather than the
 * observer and still ran for all three, which is what made the loss so quiet —
 * every file really did land in the channel's Files library, while only the
 * last one was ever staged and the other two chips sat at "100%" forever with
 * nothing but a Cancel, pinning a `File` of up to 15MB and an `AbortController`
 * for the life of the tab. A promise per call is not shared state, so each
 * upload settles on its own. The Files tray met this first and
 * `../files/use-upload-queue.ts` is the worked example.
 *
 * AND THE IN-FLIGHT ROW LEAVES IN A `finally` — the one path that staged,
 * refused, cancelled and threw all pass through — so no chip can outlive the
 * upload it describes.
 *
 * A SEND WAITS FOR ITS UPLOADS. While anything is in flight, Send is refused —
 * with the reason in its accessible name, and the percentage already on screen
 * beside it. The alternative is a message that posts without the file the
 * reader watched themselves attach, which is the exact failure this whole
 * change exists to end.
 *
 * THE CAP 422 NEVER REACHES THE READER. The ten-file limit is refused HERE,
 * before the upload is even started, so a file that could not have been carried
 * is never put in the library either. The server's OTHER attachment 422 — the
 * same file twice — is unreachable by construction rather than by guard: every
 * upload mints its own library row with its own id, so choosing one file twice
 * stages two ids and posts two ids, which is what the server expects (it
 * dedupes on id, and no id can repeat). `stagedIdsRef` records that invariant
 * so two uploads settling in one tick cannot break it.
 *
 * The thumbnail on a staged image is the LOCAL `File` via `createObjectURL`,
 * not the returned `url`: it paints in the same frame with no request, it
 * cannot expire mid-compose (the server's URL is signed for an hour), and it
 * is unarguably the bytes the reader just chose. Every object URL created here
 * is revoked when its chip leaves — on removal, on send, on the file being
 * deleted out from under it, and on unmount.
 *
 * SENDING WITH NO WORDS IS A SEND. `canSend` reads files OR text, and an empty
 * caption omits `content` from the payload entirely rather than sending `""`
 * (both post; only one of them is honest about there being no caption).
 *
 * EMOJI IS THE PRODUCT'S ONE VOCABULARY. It inserts from `REACTION_TRAY`, the
 * curated set the reaction surfaces already use, rather than shipping an emoji
 * keyboard (a dependency, a search box and a grid of two thousand pictures
 * hanging off a chat row). It is a separate control from `ReactionTrayRow`
 * because the semantics differ: those keys are toggles carrying `aria-pressed`
 * against a message's buckets, these insert text at a caret.
 *
 * MENTIONS: `@` triggers the roster autocomplete plus the synthetic Lawexa
 * candidate; ArrowUp/Down navigate, Enter/Tab apply, Escape dismisses. The
 * AtSign control drops an `@` at the caret and opens the picker (v1's
 * affordance).
 *
 * WHAT IT INSERTS IS THE MEMBER'S UNIQUE `@username` (§F.19). It used to insert
 * a slug of the display name, which as of 2026-08-05 tags nobody. Each row
 * carries name + handle, so the two people called "Ada Obi" — the case this
 * whole change exists for — are told apart BEFORE either is picked, and the
 * query matches either field so nobody has to know a handle to use one.
 *
 * A MEMBER WITH NO HANDLE IS NEVER A ROW. No string tags them — guests never
 * get a handle, and neither does any account still waiting on the backfill —
 * and a row that cannot keep its promise is worse than no row at all. They are
 * named instead in one quiet line under the list, because a reader who can see
 * someone in the member list and not here is owed the reason. Measured
 * 2026-08-05, that line is currently the whole picker.
 *
 * THE COUNTER APPEARS AT 200 REMAINING, not 500. At 500 it was on screen for
 * a message most people never write, which made a number ride the composer
 * during ordinary typing for no reason; 200 is close enough to the wall to be
 * a warning rather than furniture.
 *
 * KEYBOARD: Enter sends / Shift+Enter breaks on precise-pointer setups; on
 * touch (`hover: none`, read at event time) Enter breaks and the send button
 * posts — the v1 contract, kept. The surface rides the keyboard through the
 * shell's dvh + `--keyboard-inset` region (never `position: fixed`).
 */

const MAX_SUGGESTIONS = 6;

/** How much room is left before the counter is worth showing. */
const COUNTER_AT = 200;

/**
 * Why a send is refused while bytes are still moving. ONE string, said in two
 * places: it is the Send button's accessible name, and it is the tray notice a
 * KEYBOARD sender gets when Enter does nothing — a disabled button explains
 * itself to anyone who reaches it, and explains nothing at all to someone who
 * never touches it.
 */
const UPLOAD_STILL_RUNNING = 'Waiting for the upload to finish.';

export interface ChannelComposerHandle {
  focus: () => void;
}

export interface ChannelComposerProps {
  channel: Channel;
  viewerId: number | null;
  replyTo: Message | null;
  onCancelReply: () => void;
  /** Throttled typing whisper (the room hook's emitter). */
  onTyping: () => void;
  /** Who is typing right now — rendered as the shell's top-edge legend. */
  typingUsers: readonly TypingUser[];
  /** A send was ACCEPTED by the server — the screen advances the read
   *  pointer with the new uuid (§5's send trigger). */
  onSentSuccess: (serverUuid: string) => void;
  /** Show the Files section — offered from the staging tray, which is where a
   *  reader learns their attachments are already in the library. */
  onOpenFiles: () => void;
  ref?: React.Ref<ChannelComposerHandle>;
}

/** Build the optimistic row's quote context from the reply target. */
function toReplyPreview(message: Message): MessageReplyTo {
  return {
    uuid: message.uuid,
    is_ai: message.is_ai,
    author: message.author,
    content_preview: message.content.slice(0, 200),
    is_deleted: false,
    type: message.metadata.type,
    // The optimistic quote must be able to describe a file-only target too;
    // without this the quote on the reader's own reply would render blank
    // until the server row replaced it.
    attachment_count: message.attachments?.length ?? 0,
  };
}

/**
 * The uploaded row as a message attachment. An explicit projection rather than
 * passing the `ChannelFile` through: it is assignable (the attachment shape is
 * a subset), but it would put an `uploader` into the cache that no server
 * message row carries, and a field that exists only on rows we built ourselves
 * is a trap for the next reader.
 */
function toMessageAttachment(file: ChannelFile): MessageAttachment {
  return {
    id: file.id,
    url: file.url,
    original_name: file.original_name,
    mime_type: file.mime_type,
    size: file.size,
    category: file.category,
    upload_status: file.upload_status,
    created_at: file.created_at,
  };
}

/** One upload the composer started and has not yet heard back about. */
interface PendingUpload {
  id: number;
  name: string;
  /** Whole percent of BYTES SENT — not completion. See the docblock. */
  percent: number;
  controller: AbortController;
}

/** One file waiting to ride the next send. */
interface StagedAttachment {
  file: MessageAttachment;
  /** `blob:` preview of the LOCAL file for an image chip, revoked when the
   *  chip leaves; `null` for everything else. See the docblock for why this is
   *  the local bytes rather than the server's one-hour URL. */
  preview: string | null;
  /**
   * THE ORDER THE READER PICKED IN, which is not the order the uploads finish
   * in. Concurrent uploads settle by size and by luck, so appending on arrival
   * made a three-file pick read back shuffled — and differently on each run.
   * The server preserves `attachment_ids` order, so the tray and the sent
   * message would have disagreed with the file dialog for no reason a reader
   * could see. This is the upload's own monotonic id, and the tray keeps its
   * rows sorted by it.
   */
  pick: number;
}

export function ChannelComposer({
  channel,
  viewerId,
  replyTo,
  onCancelReply,
  onTyping,
  typingUsers,
  onSentSuccess,
  onOpenFiles,
  ref,
}: ChannelComposerProps) {
  const [value, setValue] = useState('');
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  /** One refusal sentence — an unsupported file, an oversized one, a failed
   *  upload, the ten-file cap, or an Enter that arrived while bytes were still
   *  moving. Never a confirmation: staging IS the confirmation now. */
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState<readonly PendingUpload[]>([]);
  /** Everything this composer has staged. Not what is on screen — see
   *  {@link staged} directly below, which is the list every other line in this
   *  component reads. */
  const [stagedRows, setStagedRows] = useState<readonly StagedAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadIdRef = useRef(0);
  /** Uploads the reader called off. An abort rejects like any other failure,
   *  so this is how the composer tells "it broke" from "I stopped it". */
  const cancelledUploadsRef = useRef(new Set<number>());
  /** Every object URL this composer has minted and not yet revoked. Written
   *  only from event handlers and the removal effect — never in render, which
   *  the React Compiler rules forbid outright. */
  const objectUrlsRef = useRef(new Set<string>());
  /** Every id this composer has ever claimed — the guard that keeps two
   *  uploads settling in the same tick from staging one row twice. It lives in
   *  a ref rather than being derived in render because the check runs inside an
   *  upload callback, where the closure's staged list may be a frame behind.
   *  An id the LIBRARY has since dropped is deliberately left in it: that id
   *  can never be minted again, so nothing is being locked out. */
  const stagedIdsRef = useRef(new Set<number>());

  /**
   * The files that will actually ride the next send.
   *
   * A staged chip is a LIBRARY ROW, and the library can lose it while the
   * composer is holding it (see the component docblock). The store is the
   * authority on that, so the visible list is derived rather than patched:
   * there is no window in which a dead id is still armed, and no state to keep
   * in step with an event. Returns the exact `stagedRows` reference whenever
   * nothing has been revoked, so the ordinary case allocates nothing and the
   * memo boundaries below hold.
   */
  const removedFileIds = useRemovedChannelFiles(channel.uuid);
  const staged = useMemo(() => {
    if (removedFileIds.size === 0) return stagedRows;
    const live = stagedRows.filter((entry) => !removedFileIds.has(entry.file.id));
    return live.length === stagedRows.length ? stagedRows : live;
  }, [stagedRows, removedFileIds]);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  /**
   * The one chip exit with no handler behind it: the FILE was deleted, here or
   * by another member, so nothing in this component ran and there is nowhere
   * else to release the preview. Un-staging and sending revoke in the handler
   * that caused them; this is the third door.
   *
   * IT READS `stagedRows`, NOT `staged`, AND THAT IS THE WHOLE SAFETY OF IT. A
   * preview that has been minted but whose `setStagedRows` has not committed yet
   * is in no list this effect can see, so a passive flush landing between an
   * upload settling and its chip appearing cannot revoke a URL that chip is
   * about to paint. Revoking is idempotent, so a re-run costs nothing.
   *
   * Revoking a URL an `<img>` has already loaded does not unpaint it, so the
   * staging tray's held-content exit still shows its thumbnails all the way
   * through the collapse.
   */
  useEffect(() => {
    if (removedFileIds.size === 0) return;
    for (const entry of stagedRows) {
      if (!entry.preview || !removedFileIds.has(entry.file.id)) continue;
      URL.revokeObjectURL(entry.preview);
      objectUrlsRef.current.delete(entry.preview);
    }
  }, [stagedRows, removedFileIds]);

  // Leaving the conversation mid-compose must not leak the previews. Captured
  // into a local at effect time (the ref object is stable, so this is the
  // sanctioned form of a cleanup that reads a ref).
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const send = useSendChannelMessage(channel.uuid);
  const upload = useUploadChannelFile(channel.uuid);
  /** `mutateAsync`, never `mutate` — one observer cannot hold per-call
   *  callbacks for concurrent uploads. See the docblock. */
  const uploadAsync = upload.mutateAsync;
  const membersQuery = useQuery({
    ...channelsQueries.members(channel.uuid, { viewerId }),
    enabled: channel.is_member === true,
  });

  // Auto-grow the textarea to a cap, then scroll internally — a DOM height
  // write (no state); a raw textarea is needed here for caret-aware mention
  // parsing.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const options = useMemo(
    () => buildMentionOptions(membersQuery.data?.data ?? []),
    [membersQuery.data],
  );

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const query = mention.query;
    return options.candidates
      .filter(
        (candidate) =>
          candidate.handle.includes(query) ||
          candidate.name.toLowerCase().includes(query),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [mention, options]);

  /** Members the same query names who have no handle — the picker's one
   *  explanatory line, never rows. Filtered by the SAME query so the sentence
   *  answers the search that is on screen, not the whole roster. */
  const untaggable = useMemo(() => {
    if (!mention) return '';
    const query = mention.query;
    return untaggableSentence(
      options.untaggable.filter((name) => name.toLowerCase().includes(query)),
    );
  }, [mention, options]);

  /** Is the picker actually ON SCREEN? A pending `@token` that matches nobody
   *  and explains nobody shows nothing, and Escape must not be swallowed by an
   *  invisible surface — the reply bar behind it is what the reader meant. */
  const pickerOpen = mention !== null && (suggestions.length > 0 || untaggable !== '');

  // Every tray row — and the typing legend — holds its last content through
  // its own fade, so nothing ever animates out while empty.
  const replyShown = useHeldValue(replyTo);
  const aiNoticeShown = useHeldValue(aiNotice);
  const noticeShown = useHeldValue(notice);
  const stagedShown = useHeldValue(staged.length > 0 ? staged : null) ?? staged;
  const typing = typingUsers.length > 0;
  const typingShown = useHeldValue(typing ? typingLabel(typingUsers) : null);

  const detectMention = (nextValue: string, caret: number) => {
    const upToCaret = nextValue.slice(0, caret);
    const match = upToCaret.match(/(?:^|\s)@([a-z0-9._]*)$/i);
    if (match) {
      setMention({ query: match[1].toLowerCase(), start: caret - match[1].length - 1 });
      setActiveIndex(0);
    } else {
      setMention(null);
    }
  };

  /** Put text where the caret is and leave the caret after it. Shared by the
   *  mention affordance and the emoji picker so the two can never drift on
   *  focus restoration or caret maths. */
  const insertAtCaret = (
    text: string,
    options?: { spaceGuard?: boolean; thenDetect?: boolean },
  ) => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const inserted =
      options?.spaceGuard && before.length > 0 && !/\s$/.test(before)
        ? ` ${text}`
        : text;
    const nextValue = before + inserted + value.slice(caret);
    const nextCaret = caret + inserted.length;
    setValue(nextValue);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (node) {
        node.focus();
        node.setSelectionRange(nextCaret, nextCaret);
      }
      if (options?.thenDetect) detectMention(nextValue, nextCaret);
    });
  };

  const applyMention = (candidate: MentionCandidate) => {
    if (!mention) return;
    const before = value.slice(0, mention.start);
    const after = value.slice(mention.start + 1 + mention.query.length);
    const inserted = `@${candidate.handle} `;
    const nextValue = before + inserted + after;
    const caret = (before + inserted).length;
    setValue(nextValue);
    setMention(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  /* ── Attachments ──────────────────────────────────────────────────────────
        Client pre-validation only saves a round trip — the server sniffs the
        content, so a renamed `.exe` still 422s and lands in the same notice.
        A rejection never enters the in-flight list, so the "uploading" row is
        only ever things that are actually uploading.

        THE CAP IS CHECKED BEFORE THE UPLOAD, counting what is staged AND what
        is still on the wire. Refusing after the fact would leave a file in the
        channel's library that no message could ever carry — a stray upload
        caused by a limit the reader was never shown. ─────────────────────── */
  const revokePreview = (url: string | null) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  };

  /** Put a finished upload's library row in the staging tray, in the position
   *  the reader picked it in rather than the one it finished in. */
  const stage = (file: File, uploaded: ChannelFile, pick: number) => {
    const attachment = toMessageAttachment(uploaded);
    // A repeated id cannot come out of this path — every upload mints a new
    // library row — and this guard is what makes the server's "The same file
    // cannot be attached twice." 422 unreachable rather than merely unlikely.
    // It is checked FIRST so a refused stage never creates an object URL it
    // would then have to clean up.
    if (stagedIdsRef.current.has(attachment.id)) return;
    stagedIdsRef.current.add(attachment.id);
    // The local bytes, not the server's signed URL — see the docblock. Only
    // for a format the browser will actually paint, so a chip can never hold
    // an object URL nothing can render.
    const preview = isRenderableImage(attachment)
      ? URL.createObjectURL(file)
      : null;
    if (preview) objectUrlsRef.current.add(preview);
    setStagedRows((current) =>
      [...current, { file: attachment, preview, pick }].sort(
        (left, right) => left.pick - right.pick,
      ),
    );
  };

  /**
   * One upload, start to finish, on its OWN promise — the whole reason this is
   * `mutateAsync` and a `try`/`catch` rather than the observer callbacks the
   * shipped version passed to `mutate()`. See the docblock.
   *
   * THE ROW IS RETIRED IN THE `finally`, which every outcome passes through:
   * staged, refused by the server, called off by the reader, or a transport
   * that threw before the request left. That is what makes a chip stuck at
   * "100%" with no promise behind it structurally impossible rather than
   * merely unobserved.
   */
  const runUpload = async (entry: PendingUpload, file: File) => {
    try {
      const response = await uploadAsync({
        file,
        signal: entry.controller.signal,
        onProgress: (sent, total) => {
          const percent =
            total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
          // The updater returns its EXACT input when the whole percent has not
          // moved, so a hundred progress events cost at most a hundred renders
          // of this small subtree — never one per packet under the reader's
          // cursor while they are typing.
          setUploading((current) => {
            const row = current.find((candidate) => candidate.id === entry.id);
            if (!row || row.percent === percent) return current;
            return current.map((candidate) =>
              candidate.id === entry.id ? { ...candidate, percent } : candidate,
            );
          });
        },
      });
      // A CANCEL THAT LOST THE RACE IS STILL A CANCEL. Once the last byte is
      // sent an abort stops nothing the server is doing, so this promise can
      // resolve after the reader pressed Cancel — and staging the file then
      // would put a chip on the message they had just taken it off. The upload
      // stands (nothing takes an upload back), which is exactly what the tray's
      // own line already says removing a chip means.
      if (!cancelledUploadsRef.current.has(entry.id)) {
        // `entry.id` is the monotonic upload counter, so it IS the pick order —
        // for one gesture and across gestures alike.
        stage(file, response.data, entry.id);
      }
    } catch (error) {
      // Asked for: the row simply leaves. Reporting a "failure" the reader
      // caused on purpose would be the app arguing with them.
      if (!cancelledUploadsRef.current.has(entry.id)) {
        setNotice(`${file.name} — ${extractApiError(error).message}`);
      }
    } finally {
      // Drained HERE and not in the branches above, so an abort that raced a
      // completing upload cannot leave its id in the set for the life of the
      // component.
      cancelledUploadsRef.current.delete(entry.id);
      setUploading((current) => current.filter((row) => row.id !== entry.id));
    }
  };

  const attachFiles = (list: readonly File[]) => {
    // Read once per picked file rather than from state, which does not update
    // between iterations of this loop.
    let claimed = staged.length + uploading.length;
    const accepted: { entry: PendingUpload; file: File }[] = [];

    for (const file of list) {
      if (claimed >= MAX_MESSAGE_ATTACHMENTS) {
        setNotice(
          `A message can carry ${MAX_MESSAGE_ATTACHMENTS} files, so "${file.name}" wasn't attached. Send these first.`,
        );
        continue;
      }
      const invalid = validateChannelFile(file);
      if (invalid) {
        setNotice(invalid);
        continue;
      }
      claimed += 1;
      accepted.push({
        entry: {
          id: (uploadIdRef.current += 1),
          name: file.name,
          percent: 0,
          controller: new AbortController(),
        },
        file,
      });
    }

    if (accepted.length === 0) return;
    // ONE commit for the whole gesture: three files picked together open the
    // tray once instead of playing its reveal three times.
    const rows = accepted.map(({ entry }) => entry);
    setUploading((current) => [...current, ...rows]);
    // `void`: each attempt owns its promise and reports through state.
    for (const { entry, file } of accepted) void runUpload(entry, file);
  };

  const cancelUpload = (entry: PendingUpload) => {
    cancelledUploadsRef.current.add(entry.id);
    entry.controller.abort();
  };

  /** Un-stage one file. It stays in the channel's library — the tray says so. */
  const unstage = (entry: StagedAttachment) => {
    revokePreview(entry.preview);
    stagedIdsRef.current.delete(entry.file.id);
    setStagedRows((current) => current.filter((row) => row.file.id !== entry.file.id));
  };

  const handleSend = () => {
    const content = value.trim();
    if (content.length > MESSAGE_MAX_LENGTH) return;
    // Files alone are a message; nothing at all is a 422 the server would
    // rightly refuse, so it never leaves here.
    if (content === '' && staged.length === 0) return;
    // A send while an upload is still on the wire would post without it. The
    // button says so in its accessible name; Enter has no button to say it
    // with, so the tray does — a keystroke that does nothing and explains
    // nothing is the reader being ignored.
    if (uploading.length > 0) {
      setNotice(UPLOAD_STILL_RUNNING);
      return;
    }

    send.mutate(
      {
        content,
        replyToUuid: replyTo?.uuid ?? null,
        replyToPreview: replyTo ? toReplyPreview(replyTo) : null,
        attachments: staged.map((entry) => entry.file),
      },
      {
        onSuccess: (response) => {
          onSentSuccess(response.data.uuid);
          // The `ai` block exists only when @lawexa was summoned; a blocked /
          // errored summon is PRIVATE to the summoner (§F.12) — an inline
          // notice here, never a toast, never a feed row.
          const ai = response.data.ai;
          if (ai && ai.status !== 'dispatched') {
            setAiNotice(
              ai.status === 'blocked'
                ? (ai.reason?.message ?? 'You have reached your AI usage limit.')
                : "Something went wrong starting Lawexa's response. Mention @lawexa again to retry.",
            );
          }
        },
      },
    );
    setValue('');
    setMention(null);
    for (const entry of staged) revokePreview(entry.preview);
    stagedIdsRef.current.clear();
    setStagedRows([]);
    if (replyTo) onCancelReply();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter during IME composition confirms the composition — it must never
    // apply a mention or send the message (audit M5 — CJK input).
    if (event.key === 'Enter' && event.nativeEvent.isComposing) return;

    if (pickerOpen) {
      // Navigation and apply need something to land ON. The picker can be open
      // with no rows at all — showing only the can't-be-tagged line — and in
      // that state Enter must send the message like any other Enter.
      if (suggestions.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveIndex((index) => (index + 1) % suggestions.length);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveIndex(
            (index) => (index - 1 + suggestions.length) % suggestions.length,
          );
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          applyMention(suggestions[activeIndex]);
          return;
        }
      }
      // Escape dismisses whatever the picker is showing — rows or a sentence.
      if (event.key === 'Escape') {
        event.preventDefault();
        setMention(null);
        return;
      }
    }

    if (event.key === 'Escape' && replyTo) {
      event.preventDefault();
      onCancelReply();
      return;
    }

    // Touch keyboards: Enter breaks; the send button posts (capability read
    // at event time — no subscription, no render-phase media query).
    const coarse = window.matchMedia('(hover: none)').matches;
    if (event.key === 'Enter' && !event.shiftKey && !coarse) {
      event.preventDefault();
      handleSend();
    }
  };

  const remaining = MESSAGE_MAX_LENGTH - value.length;
  const uploadingNow = uploading.length > 0;
  const canSend =
    (value.trim().length > 0 || staged.length > 0) && remaining >= 0 && !uploadingNow;
  /** Why Send is refused, when the reason is not simply "nothing to send".
   *  It becomes the button's accessible name, because a disabled control with
   *  no explanation is a dead end for anyone who cannot see the percentage
   *  counting up two rows above it. */
  const sendBlockedReason = uploadingNow ? UPLOAD_STILL_RUNNING : null;
  const replyingToName = replyShown
    ? replyShown.is_ai
      ? 'Lawexa'
      : (replyShown.author?.name ?? 'Deleted member')
    : '';

  return (
    <ChatComposerShell
      typing={{ label: typingShown ?? '', visible: typing }}
      tray={
        <>
          {/* Mention autocomplete — floats above the whole tray. It opens for
              a line that has nothing to OFFER but something to SAY, which is
              the live state today: every row is a person with a handle, and
              everyone else is the sentence underneath. */}
          {pickerOpen && (
            <div
              className={cn(
                'absolute bottom-full left-0 z-20 mb-2 w-72 max-w-full overflow-hidden rounded-xl border bg-popover shadow-md',
                'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1',
                'motion-safe:duration-150',
              )}
            >
              {suggestions.length > 0 && (
                <ul role="listbox" aria-label="Mention someone">
                  {suggestions.map((candidate, index) => (
                    <li
                      key={candidate.key}
                      role="option"
                      aria-selected={index === activeIndex}
                    >
                      <button
                        type="button"
                        // Fire before the textarea blurs so the insertion lands.
                        onMouseDown={(event) => {
                          event.preventDefault();
                          applyMention(candidate);
                        }}
                        onPointerEnter={() => setActiveIndex(index)}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                          index === activeIndex && 'bg-accent',
                        )}
                      >
                        {candidate.user === null ? (
                          <LawexaAvatar size="sm" />
                        ) : (
                          <MemberAvatar user={candidate.user} size="sm" />
                        )}
                        <span className="truncate">{candidate.name}</span>
                        {/* The handle is what separates two people with one
                            name — the reason this row has a second column. */}
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          @{candidate.handle}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {untaggable !== '' && (
                <p
                  className={cn(
                    'px-3 py-2 text-xs text-muted-foreground',
                    suggestions.length > 0 && 'border-t',
                  )}
                >
                  {untaggable}
                </p>
              )}
            </div>
          )}

          <ComposerTrayRow open={aiNotice !== null}>
            <ComposerNotice
              text={
                <>
                  <span className="font-medium">Lawexa couldn&rsquo;t respond.</span>{' '}
                  {aiNoticeShown}
                </>
              }
              onDismiss={() => setAiNotice(null)}
            />
          </ComposerTrayRow>

          <ComposerTrayRow open={notice !== null}>
            <ComposerNotice
              text={noticeShown ?? ''}
              onDismiss={() => setNotice(null)}
            />
          </ComposerTrayRow>

          {/* In-flight uploads, with the real figure and a real way out. The
              fill is `aria-hidden` and carries no `role="progressbar"`: that
              role is on ARIA's presentational-children list, so putting it on
              the chip would delete the Cancel button inside it — the same trap
              the unread divider had to be moved off `role="separator"` for. The
              percentage is plain text, which every reader gets. */}
          <ComposerTrayRow open={uploading.length > 0}>
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
              {uploading.map((entry) => (
                <span
                  key={entry.id}
                  className="relative inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-full border py-0.5 pr-1 pl-2"
                >
                  <span
                    aria-hidden
                    style={{ width: `${entry.percent}%` }}
                    className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-200 ease-out motion-reduce:transition-none"
                  />
                  <Paperclip aria-hidden className="relative size-3 shrink-0" />
                  <span className="relative min-w-0 truncate">{entry.name}</span>
                  <span className="relative shrink-0 tabular-nums text-muted-foreground/70">
                    {entry.percent}%
                  </span>
                  <button
                    type="button"
                    onClick={() => cancelUpload(entry)}
                    aria-label={`Cancel uploading ${entry.name}`}
                    title="Cancel"
                    className={cn(
                      'v2-interactive relative flex size-5 shrink-0 items-center justify-center rounded-full',
                      'text-muted-foreground transition-colors duration-150',
                      'hover:bg-secondary hover:text-foreground motion-reduce:transition-none',
                      FOCUS_RING,
                    )}
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </ComposerTrayRow>

          {/* Staged attachments — what the next send will carry.

              THE LINE UNDER THEM IS NOT A DISCLAIMER, IT IS THE FACT. An
              upload lands in the channel's library the moment it completes;
              staging only decides which message carries it. So the tray states
              that plainly while it is on screen, and offers the Files section
              as the place to go — which is also the only honest answer to
              "then how do I actually delete it?". */}
          <ComposerTrayRow open={staged.length > 0}>
            <div className="rounded-xl border bg-background px-3 py-2">
              <ul
                aria-label="Files on this message"
                className="flex flex-wrap items-center gap-1.5"
              >
                {stagedShown.map((entry) => (
                  <li
                    key={entry.file.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-1"
                  >
                    {entry.preview ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- a blob: object URL for the local file; next/image cannot take one, and there is nothing to optimise. */
                      <img
                        src={entry.preview}
                        alt=""
                        aria-hidden
                        width={20}
                        height={20}
                        className="size-5 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <Paperclip
                        aria-hidden
                        className="ml-1 size-3 shrink-0 text-muted-foreground"
                      />
                    )}
                    <span className="min-w-0 truncate text-xs text-foreground">
                      {entry.file.original_name}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                      {formatBytes(entry.file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => unstage(entry)}
                      aria-label={`Don't send ${entry.file.original_name}`}
                      title="Remove from this message"
                      className={cn(
                        'v2-interactive flex size-5 shrink-0 items-center justify-center rounded-full',
                        'text-muted-foreground transition-colors duration-150',
                        'hover:bg-secondary hover:text-foreground motion-reduce:transition-none',
                        FOCUS_RING,
                      )}
                    >
                      <X aria-hidden className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                Already in this channel&rsquo;s{' '}
                <button
                  type="button"
                  onClick={onOpenFiles}
                  className={cn(
                    'rounded font-medium text-primary underline underline-offset-2',
                    FOCUS_RING,
                  )}
                >
                  files
                </button>
                . Removing one here won&rsquo;t delete it.
              </p>
            </div>
          </ComposerTrayRow>

          {/* Reply staging bar — symmetric collapse, last content held. */}
          <ComposerTrayRow open={replyTo !== null}>
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs">
              <CornerUpLeft aria-hidden className="size-3.5 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate text-muted-foreground">
                Replying to{' '}
                <span className="font-medium text-foreground">{replyingToName}</span>
                {/* `messagePreviewText`, not `.content`: replying to a message
                    made only of files would otherwise trail off after the
                    name, which reads as a bar that failed to fill in. */}
                {replyShown ? ` — ${messagePreviewText(replyShown)}` : ''}
              </p>
              <button
                type="button"
                onClick={onCancelReply}
                aria-label="Cancel reply"
                className={cn(
                  'shrink-0 rounded text-muted-foreground hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </div>
          </ComposerTrayRow>
        </>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT_ATTR}
        className="hidden"
        onChange={(event) => {
          attachFiles(Array.from(event.target.files ?? []));
          // Let the same file be chosen twice in a row.
          event.target.value = '';
        }}
      />

      <ComposerAction
        label="Attach a file"
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip aria-hidden className="size-4" />
      </ComposerAction>

      <ComposerAction
        label="Mention someone"
        onClick={() => insertAtCaret('@', { spaceGuard: true, thenDetect: true })}
      >
        <AtSign aria-hidden className="size-4" />
      </ComposerAction>

      <EmojiInsert onPick={(emoji) => insertAtCaret(emoji)} />

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          detectMention(
            event.target.value,
            event.target.selectionStart ?? event.target.value.length,
          );
          if (event.target.value.trim()) onTyping();
        }}
        onKeyDown={handleKeyDown}
        // PASTE A PICTURE AND IT ATTACHES, which is the whole affordance: a
        // screenshot is the commonest thing anyone has on a clipboard, and
        // before this it silently did nothing at all. It runs the SAME path as
        // the paperclip — same allow-list, same cap, same staging tray, same
        // send — so a pasted file and a picked one cannot behave differently.
        //
        // A PASTE THAT ALSO CARRIES WORDS KEEPS ITS WORDS. Copying a cell out
        // of a spreadsheet, or a block of rich text, puts both a picture and
        // plain text on the clipboard; swallowing the text there would break
        // ordinary pasting to serve the rarer case. So the default is only
        // prevented when the clipboard has nothing to type.
        onPaste={(event) => {
          const files = filesFromClipboard(event.clipboardData);
          if (files.length === 0) return;
          if (!event.clipboardData.getData('text/plain').trim()) {
            event.preventDefault();
          }
          attachFiles(files);
        }}
        rows={1}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder={`Message ${channel.name}`}
        aria-label={`Message ${channel.name}`}
        className="max-h-[200px] min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
      />

      {remaining <= COUNTER_AT && (
        <span
          aria-live="polite"
          className={cn(
            'shrink-0 self-center text-xs tabular-nums',
            remaining < 0 ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          {remaining}
        </span>
      )}

      <Button
        type="button"
        size="icon"
        className="size-8 shrink-0 rounded-lg"
        onClick={handleSend}
        disabled={!canSend}
        aria-label={sendBlockedReason ?? 'Send message'}
        title={sendBlockedReason ?? 'Send message'}
      >
        <SendHorizontal aria-hidden className="size-4" />
      </Button>
    </ChatComposerShell>
  );
}

/**
 * The emoji control — the curated {@link REACTION_TRAY}, inserted at the caret.
 * See the component docblock for why this is not `ReactionTrayRow`.
 */
function EmojiInsert({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Insert an emoji"
          title="Insert an emoji"
          className={COMPOSER_ACTION}
        >
          <Smile aria-hidden className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-auto rounded-2xl p-1"
      >
        <div role="group" aria-label="Insert an emoji" className="flex items-center gap-0.5">
          {REACTION_TRAY.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Insert ${emoji}`}
              onClick={() => {
                setOpen(false);
                onPick(emoji);
              }}
              className={cn(
                'v2-interactive flex size-8 items-center justify-center rounded-full text-lg',
                'transition-[background-color,transform] duration-150 motion-reduce:transition-none',
                'hover:bg-muted hover:scale-110 motion-reduce:hover:scale-100',
                FOCUS_RING,
              )}
            >
              <span aria-hidden className="leading-none">
                {emoji}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** ONE quiet line, never stacked bubbles (DIRECTION 7). */
function typingLabel(users: readonly TypingUser[]): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0].name} is typing…`;
  if (users.length === 2) {
    return `${users[0].name} and ${users[1].name} are typing…`;
  }
  return 'Several people are typing…';
}
