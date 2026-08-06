'use client';

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
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
  REACTION_TRAY,
  replyQuoteText,
  untaggableSentence,
  validateChannelFile,
  type MentionCandidate,
} from '../model';
import { channelsQueries } from '../queries';
import { useRemovedChannelFiles } from '../removed-files';
import { useRestoredFailures } from '../send-outbox';
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
import {
  readChannelDraft,
  saveChannelDraft,
  useDraftFileCheck,
  type ChannelDraft,
  type DraftAttachment,
} from './composer-draft';

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
 *
 * ── A HALF-WRITTEN MESSAGE SURVIVES THE TAB (owner, 2026-08-06) ────────────
 * "I was typing a long message and my tab closed and I lost everything." It
 * did, and there was nothing anywhere to get it back from. The whole armed
 * state is now mirrored to the device per channel — the words, the reply, and
 * the files — by `./composer-draft.ts`, which owns what a draft IS and how a
 * restored one is made trustworthy again; read its docblock before changing
 * anything here.
 *
 * THREE THINGS ABOUT IT BELONG IN THIS FILE.
 *
 * FIRST, THE REPLY IS RESTORED AS A QUOTE, NOT AS A MESSAGE. This composer is
 * handed its reply target as a `Message` PROP and can only ever hand it back
 * (`onCancelReply`) — it cannot set one, and there is no `GET /messages/{uuid}`
 * to resolve a saved uuid with, and subscribing this component to the
 * transcript to go looking would re-render the box under the reader's cursor on
 * every message anyone sends. What both the reply bar and the optimistic row
 * actually need is the `MessageReplyTo` QUOTE, which is a plain record — so
 * that is what is saved and what comes back, and {@link replyQuote} is the ONE
 * reply target this component has, whether the feed just set it or a draft
 * brought it back. The parent still owns the live one; nothing here fakes a
 * setter it does not have.
 *
 * SECOND, A RESTORED CHIP IS A CLAIM, NOT A FILE. The ids come off the device;
 * the ROWS come from the library (`useDraftFileCheck`). Send is refused until
 * that answer arrives, because posting the caption without files the reader can
 * see chips for is precisely the failure the attachment work exists to end, and
 * a file somebody deleted meanwhile leaves with one quiet line naming it. A
 * restored chip never shows a thumbnail: the local bytes did not survive the
 * tab, and the server's URL is signed for about an hour, so the honest chip is
 * the paperclip one every non-image file already gets.
 *
 * A REFUSAL THAT LASTS MUST BE ON SCREEN, NOT IN A `title`. That wait blocks the
 * WHOLE message, words and all, and it is the composer's own doing rather than
 * anything the reader did — so it says so in the tray while it lasts, and does
 * not wait to be asked by a keystroke a touch reader has no way to make. The
 * wait itself is bounded because the check is `networkMode: 'always'` (see
 * `./composer-draft.ts`): offline it FAILS, with a sentence, and the message
 * goes.
 *
 * THIRD, THE COMPOSER REMOUNTS WHEN THE ACCOUNT CHANGES. Sign-out and sign-in
 * are both SOFT navigations in this app (`v2/runtime/cache-identity-guard.tsx`
 * has the full account of that trap), so without a `key` the next reader would
 * inherit this one's words, their staged ids and their live object URLs. A
 * remount is the only reset that reaches all three — piecemeal clearing in
 * render would be both a lint error and a list somebody will forget to extend.
 *
 * AND WHAT IS NOT IN THIS FILE: TAKING THE PREVIOUS READER'S WORDS OFF THE
 * DEVICE. Both device sweeps used to run from here, and this component mounts
 * only for someone who can POST — so a reader who never opened a channel they
 * could write in left the last account's drafts and unsent messages sitting on a
 * shared computer for their whole session. They now run from
 * `../device-sweep.tsx`, at the top of the v2 tree, beside the cache guard.
 */

const MAX_SUGGESTIONS = 6;

/** How much room is left before the counter is worth showing. */
const COUNTER_AT = 200;

/** The input grows to here, then scrolls inside itself. LOCKSTEP with the
 *  textarea's own `max-h-[200px]`: the effect writes the height, and the class
 *  is what stops a first paint overshooting it before the effect runs. */
const TEXTAREA_MAX_HEIGHT = 200;

/**
 * The arrangement threshold, as a SCHMITT TRIGGER — two numbers, not one.
 *
 * Expanding gives the input the width the buttons were holding, so the very
 * same text measures FEWER lines afterwards: a single threshold would expand at
 * three lines, re-measure at two, collapse, re-measure at three, and oscillate
 * under the reader's cursor. So the way in and the way out are different
 * measurements: it opens up at a third line and does not close again until the
 * text is back to ONE.
 *
 * THE GAP IS NOT A PROOF, AND THE PARAGRAPH THAT CLAIMED IT WAS HAD BOTH
 * NUMBERS WRONG. Write `r` for the ratio between the input's expanded and
 * compact text widths. Expanding fires when the text no longer fits TWO compact
 * lines; collapsing fires when it fits ONE expanded line. A length that does
 * both at once therefore exists exactly when `r > 2` — the bound is 2, not 3.
 * And measured off the classes this composer actually ships, at a 320px
 * viewport: the row's content box is 274px, the input holds 114px of text
 * compact (three 32px verbs, a 32px Send, four 4px gaps and the textarea's own
 * 16px of padding) and 258px expanded, so `r` = 2.26. Break-even is a 350px
 * viewport. EVERY narrower one — 320px, a Fold's cover screen, Android
 * split-screen, any phone at 125% zoom — has a band of message lengths (at
 * 320px, anything between about 228px and 258px of text) where the buttons jump
 * under and beside the input on every single keystroke.
 *
 * WHICH IS WHY THE DECISION IS VERIFIED RATHER THAN ASSUMED — see
 * {@link applyArrangement}. Widening the gap is not the fix and makes it
 * strictly worse: collapsing at two lines instead of one moves the bound to
 * `r > 1`, which no arrangement can satisfy.
 */
const EXPAND_AT_LINES = 3;
const COLLAPSE_AT_LINES = 1;

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server, because React
 * warns when a layout effect is scheduled during SSR.
 *
 * THE OLD REASON GIVEN FOR IT — "the channel screen does server-render" — WAS
 * NOT TRUE, and a false reason is worse than none. This module is evaluated on
 * the server, but the composer is not rendered there: `ChannelScreen` returns
 * its frame while the detail query is pending, and the route prefetches nothing,
 * so nobody has ever seen that warning. The branch stays for what it costs
 * (one comparison, once, at module scope) against the day this screen is given
 * the server prefetch the rest of v2 has — which would make the composer render
 * on the server and the warning real.
 *
 * IT IS A LAYOUT EFFECT FOR ITS OWN REASON, unrelated to any of that: a RESTORED
 * draft arrives with its full text in the first client render, so measuring
 * after paint would show one frame of a one-line box before it jumped to five.
 * Resolved ONCE at module scope, so the call site stays unconditional and
 * rules-of-hooks holds.
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** How long the composer waits after the last keystroke before writing the
 *  draft to the device. Long enough that ordinary typing writes once a
 *  sentence, short enough that a tab killed without a `pagehide` (a crash, a
 *  swipe-away) loses at most this much. */
const DRAFT_SAVE_DELAY_MS = 400;

/**
 * Why a send is refused while bytes are still moving. ONE string, said in two
 * places: it is the Send button's accessible name, and it is the tray notice a
 * KEYBOARD sender gets when Enter does nothing — a disabled button explains
 * itself to anyone who reaches it, and explains nothing at all to someone who
 * never touches it.
 */
const UPLOAD_STILL_RUNNING = 'Waiting for the upload to finish.';

/**
 * The same for a RESTORED draft whose files are still being checked against the
 * library. ONE string again, in two places — but not the same two.
 *
 * This refusal is not answering a keystroke: it is TRUE FROM THE MOMENT THE
 * COMPOSER OPENS, for as long as the check takes, and it blocks the whole
 * message rather than just the files. So it is a standing tray row while it
 * lasts, not a notice set from a rejected Enter. Said only in the disabled
 * button's `aria-label`/`title` it reached nobody on a phone at all — a disabled
 * button fires no click, and `title` has no touch affordance.
 */
const RESTORE_STILL_CHECKING = 'Checking the files saved with this draft.';

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
  /** Take the reader to one message in the transcript. Used for the one thing
   *  this surface knows about and the feed cannot say: a message restored from
   *  the device that failed to send in an earlier session, and therefore sits at
   *  its own timestamp, far above where the reader is looking. */
  onJumpToMessage: (messageUuid: string) => void;
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
   *  chip leaves; `null` for everything else — and always `null` for a chip a
   *  draft brought back, which has no local bytes left. See the docblock. */
  preview: string | null;
}

/** A file uploaded in THIS session, which also knows where it belongs. */
interface StagedUpload extends StagedAttachment {
  /**
   * THE ORDER THE READER PICKED IN, which is not the order the uploads finish
   * in. Concurrent uploads settle by size and by luck, so appending on arrival
   * made a three-file pick read back shuffled — and differently on each run.
   * The server preserves `attachment_ids` order, so the tray and the sent
   * message would have disagreed with the file dialog for no reason a reader
   * could see. This is the upload's own monotonic id, and the tray keeps its
   * rows sorted by it.
   *
   * A restored chip carries no pick and needs none: it was staged in an earlier
   * session, so it leads everything picked in this one by construction.
   */
  pick: number;
}

/**
 * One row of the staging tray, whatever put it there. The composer keeps two
 * ledgers behind this (uploads made now, files a draft brought back) because
 * they are cleaned up differently; the READER is shown one list, because to
 * them there is only one — the files on this message.
 */
interface TrayChip {
  id: number;
  name: string;
  size: number;
  /** `blob:` thumbnail of the local bytes; `null` for a non-image and for
   *  anything restored (see {@link StagedAttachment}). */
  preview: string | null;
  /** Restored from a draft and not yet vouched for by the library. Provisional:
   *  it renders `aria-busy` and Send waits for it. */
  checking: boolean;
}

/** Frozen empties, so a composer with nothing restored allocates nothing and
 *  the memo boundaries below hold by reference. */
const NO_STAGED: readonly StagedAttachment[] = [];
const NO_DRAFT_FILES: readonly DraftAttachment[] = [];

/**
 * How many wrapped lines the input is showing RIGHT NOW, measured rather than
 * counted: `\n`s do not describe a soft wrap, which is what the reader sees.
 *
 * `null` when the browser will not resolve a line height (a `normal` keyword
 * with no computed pixel value). We do not guess one — the arrangement simply
 * stays where it is, which is exactly the behaviour that shipped before it
 * could move at all.
 */
function wrappedLines(el: HTMLTextAreaElement): number | null {
  const style = window.getComputedStyle(el);
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return null;
  const padding =
    Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  // `scrollHeight` is only the CONTENT height while the inline height is
  // `auto`, which is the state this is always called in.
  const content = el.scrollHeight - (Number.isFinite(padding) ? padding : 0);
  return Math.max(1, Math.round(content / lineHeight));
}

/**
 * ONE measurement, TWO answers: how tall the input should be, and which
 * arrangement the row is in. Both are DOM writes and neither is state — the
 * height because it always was (a raw textarea is needed here for caret-aware
 * mention parsing), the arrangement because routing a threshold the reader
 * crosses mid-sentence through React would re-render the whole composer,
 * mention picker and all, to change two class lists.
 *
 * THE SECOND MEASUREMENT IS THE POINT. Flipping the arrangement changes the
 * input's WIDTH, so the height computed a moment earlier describes a layout that
 * no longer exists; re-reading `scrollHeight` after the attribute write forces
 * the layout the browser now owes us and sizes the box for the width it actually
 * has.
 *
 * AND THE THIRD IS WHAT MAKES THE TRIGGER SOUND AT ANY WIDTH. A COLLAPSE is
 * committed provisionally and then checked: if the same text, now measured at
 * the narrower compact width, is straight back over {@link EXPAND_AT_LINES}, the
 * collapse is reverted in the same layout pass and the row stays expanded. The
 * arrangement this function leaves behind is therefore a FIXED POINT — running
 * it again cannot move it — which is a property of the measurement rather than
 * of the viewport, so it holds at 342px, at 320px and at 280px alike, where the
 * two-number gap alone provably does not (see {@link EXPAND_AT_LINES}).
 *
 * It costs one extra reflow on the one keystroke that crosses the threshold, and
 * nothing on any other. Nothing here paints: layout effects and the
 * `ResizeObserver` callback both run before the frame, so a reverted collapse is
 * never a flash — it is a measurement the reader cannot see.
 *
 * Only the collapse needs the check. Expanding always makes the box wider, and
 * a length that satisfies the expand test in BOTH arrangements is genuinely
 * bistable (`r > 2` and text that fits one expanded line); there the function
 * stops on `expanded`, which is also where the next keystroke's revert leaves
 * it, so the row settles instead of alternating.
 */
function applyArrangement(el: HTMLTextAreaElement, row: HTMLDivElement | null): void {
  el.style.height = 'auto';

  const lines = row ? wrappedLines(el) : null;
  if (row && lines !== null) {
    const wide = row.dataset.expanded === 'true';
    const next = wide ? lines > COLLAPSE_AT_LINES : lines >= EXPAND_AT_LINES;
    if (next !== wide) {
      row.dataset.expanded = next ? 'true' : 'false';
      el.style.height = 'auto';
      const after = wrappedLines(el);
      if (after !== null && !next && after >= EXPAND_AT_LINES) {
        row.dataset.expanded = 'true';
        el.style.height = 'auto';
      }
    }
  }

  el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
}

/**
 * The composer, keyed to the account.
 *
 * A remount is the only complete reset of what this component holds for one
 * reader — the typed words, the staged ids, the live `blob:` URLs and the draft
 * key it writes to — and both halves of an account change here are soft
 * navigations that would otherwise leave every one of them in place. See the
 * third note in the component docblock.
 */
export function ChannelComposer(props: ChannelComposerProps) {
  return <ChannelComposerBody key={props.viewerId ?? 'signed-out'} {...props} />;
}

function ChannelComposerBody({
  channel,
  viewerId,
  replyTo,
  onCancelReply,
  onTyping,
  typingUsers,
  onSentSuccess,
  onOpenFiles,
  onJumpToMessage,
  ref,
}: ChannelComposerProps) {
  /**
   * The saved draft, read ONCE — a client-only read in a lazy initialiser, the
   * sanctioned form (the initialiser stays pure, and nothing here writes during
   * render). SSR and the hydration pass therefore see an empty composer and the
   * words appear on the first client render, which is why the measuring effect
   * below has to be a LAYOUT effect.
   */
  const [saved] = useState(() => readChannelDraft(viewerId, channel.uuid));
  const [value, setValue] = useState(() => saved?.text ?? '');
  /** The reply a draft brought back. Shadowed the moment the feed sets a live
   *  one, and cleared by the same {@link cancelReply} that clears the parent's,
   *  so the two can never take turns reappearing. */
  const [savedReply, setSavedReply] = useState(() => saved?.reply ?? null);
  /** The draft's files that are still armed — the reader may un-stage one
   *  before, during or after the library check. */
  const [savedFiles, setSavedFiles] = useState<readonly DraftAttachment[]>(
    () => saved?.attachments ?? NO_DRAFT_FILES,
  );
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  /** Dismissal of the one line that says what a restored draft lost. The
   *  sentence itself is DERIVED from the check — it is a fact about the draft,
   *  not an event — so only the reader's "I have read it" is state. */
  const [restoreNoticeDismissed, setRestoreNoticeDismissed] = useState(false);
  /** One refusal sentence — an unsupported file, an oversized one, a failed
   *  upload, the ten-file cap, or an Enter that arrived while bytes were still
   *  moving. Never a confirmation: staging IS the confirmation now. */
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState<readonly PendingUpload[]>([]);
  /** Everything this composer has UPLOADED and staged. Not what is on screen —
   *  see {@link staged} below, which is the list every other line in this
   *  component reads. */
  const [stagedRows, setStagedRows] = useState<readonly StagedUpload[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** The input row the arrangement is written on — see the shell's docblock. */
  const rowRef = useRef<HTMLDivElement>(null);
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
   * The draft's files, re-asked of the library. The INPUT is the list read at
   * mount rather than the mutable one, so un-staging a restored chip cannot
   * change the query key and re-ask a question already answered.
   */
  const restoreCheck = useDraftFileCheck(
    channel.uuid,
    viewerId,
    saved?.attachments ?? NO_DRAFT_FILES,
  );
  /** Nothing may be sent while this is true — see {@link RESTORE_STILL_CHECKING}. */
  const restoreChecking = restoreCheck.checking && savedFiles.length > 0;
  /**
   * The draft's files have not been ACCOUNTED FOR yet — still being checked, or
   * the check could not be made at all. The saved record keeps them either way:
   * a check that failed because the device was offline has established nothing,
   * and erasing the ids on the strength of it would turn one bad minute into a
   * permanent loss. A reload asks again.
   */
  const restoreUnresolved =
    (restoreCheck.checking || restoreCheck.failed) && savedFiles.length > 0;

  const removedFileIds = useRemovedChannelFiles(channel.uuid);

  /** The draft's surviving files as staged chips — LIVE library rows, not the
   *  stored ids, so what a send carries is what the server has right now. */
  const restoredStaged = useMemo<readonly StagedAttachment[]>(() => {
    if (restoreCheck.present.length === 0) return NO_STAGED;
    const armed = new Set(savedFiles.map((entry) => entry.id));
    const rows: StagedAttachment[] = [];
    for (const file of restoreCheck.present) {
      if (!armed.has(file.id) || removedFileIds.has(file.id)) continue;
      rows.push({ file: toMessageAttachment(file), preview: null });
    }
    return rows.length === 0 ? NO_STAGED : rows;
  }, [restoreCheck.present, savedFiles, removedFileIds]);

  /**
   * The files that will actually ride the next send.
   *
   * A staged chip is a LIBRARY ROW, and the library can lose it while the
   * composer is holding it (see the component docblock). The store is the
   * authority on that, so the visible list is derived rather than patched:
   * there is no window in which a dead id is still armed, and no state to keep
   * in step with an event. Returns the exact `stagedRows` reference whenever
   * nothing has been revoked or restored, so the ordinary case allocates
   * nothing and the memo boundaries below hold.
   */
  const staged = useMemo<readonly StagedAttachment[]>(() => {
    const filtered =
      removedFileIds.size === 0
        ? stagedRows
        : stagedRows.filter((entry) => !removedFileIds.has(entry.file.id));
    const live = filtered.length === stagedRows.length ? stagedRows : filtered;
    // Restored chips lead: they were staged in an earlier session, so they come
    // before anything picked in this one.
    return restoredStaged.length === 0 ? live : [...restoredStaged, ...live];
  }, [stagedRows, removedFileIds, restoredStaged]);

  /**
   * THE reply target — one value, whatever put it there. The live prop wins over
   * the restored quote, because a reader who has just tapped Reply on a row
   * means that row; {@link cancelReply} clears both, so the saved one can never
   * step back in behind a cancelled live one.
   */
  const replyQuote = useMemo(
    () => (replyTo ? toReplyPreview(replyTo) : savedReply),
    [replyTo, savedReply],
  );

  /**
   * What the saved draft should say this composer is holding.
   *
   * While the library check is still out, the restored ids are not in `staged`
   * yet — and writing the record without them would lose them to a SECOND tab
   * close, in the exact window the reader is least able to do anything about.
   *
   * AND THE RECORD CAN NEVER DESCRIBE AN UNSENDABLE MESSAGE. The cap on the
   * PAPERCLIP counts the chips on screen, so ids whose check failed no longer
   * hold a slot the reader can see nothing occupying — which is right, and which
   * means the record could otherwise grow past ten between sessions and come
   * back as a draft the server would refuse. So the armed files, which are real,
   * lead; the unresolved ones keep whatever room is left. Nothing is lost by it
   * that is lost anywhere else: the files are still in the channel's library,
   * and this only bites when ten OTHER files are already on the message and they
   * could not have ridden it either way.
   */
  const draftFiles = useMemo<readonly DraftAttachment[]>(() => {
    const armed = staged.map((entry) => ({
      id: entry.file.id,
      name: entry.file.original_name,
      size: entry.file.size,
    }));
    if (!restoreUnresolved) return armed;
    const room = MAX_MESSAGE_ATTACHMENTS - armed.length;
    return room <= 0 ? armed : [...savedFiles.slice(0, room), ...armed];
  }, [staged, restoreUnresolved, savedFiles]);

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

  /** Re-measure whenever the text changes. See {@link applyArrangement} for
   *  what one pass does and why it cannot leave the row somewhere it would
   *  immediately have to move away from. */
  useIsomorphicLayoutEffect(() => {
    const el = textareaRef.current;
    if (el) applyArrangement(el, rowRef.current);
  }, [value]);

  /**
   * AND WHENEVER THE ROW ITSELF CHANGES WIDTH. Typing is not the only thing that
   * moves this threshold: a rotation, a split-screen drag, the desktop sidebar
   * opening and Android's keyboard resizing the layout viewport all change how
   * many lines the SAME text wraps to. Without this the arrangement froze until
   * the next keystroke, so a five-line message written in landscape sat in a
   * ~130px column after a rotation to portrait — the precise complaint the two
   * arrangements exist to answer.
   *
   * ONE observer, no state, and the same measurement body — a second way of
   * deciding the arrangement is a second thing to get wrong.
   *
   * IT IS A WIDTH OBSERVER. `applyArrangement` writes the input's HEIGHT, which
   * changes the row's height, which would deliver another record and re-enter
   * this callback for as long as the browser cared to keep going. Comparing the
   * content width and returning early makes our own writes structurally unable
   * to re-trigger it, rather than relying on the pass being idempotent.
   */
  useEffect(() => {
    const row = rowRef.current;
    if (row === null) return;
    let lastWidth = -1;
    const observer = new ResizeObserver((records) => {
      const width = records[records.length - 1]?.contentRect.width;
      if (width === undefined || width === lastWidth) return;
      lastWidth = width;
      const el = textareaRef.current;
      if (el) applyArrangement(el, row);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  /**
   * Mirror the armed state to the device — ONE writer for three pieces of
   * state, rather than the AI chat's persist-inside-the-setter (which has one).
   * Two of these move without a setter of their own: the staged list is DERIVED
   * (a file deleted elsewhere leaves it with no handler running), and the reply
   * arrives as a prop. Four writers that could each hold a stale view of the
   * other three is how a saved draft ends up disagreeing with the box it came
   * from.
   *
   * ON A TIMER, NOT ON EVERY KEYSTROKE. This record is an object: saving it is a
   * `JSON.stringify` plus a synchronous `localStorage` write, on the main
   * thread, between the keystroke and the character appearing. The AI chat's
   * precedent writes a bare string and can afford to do it per keystroke; this
   * cannot, and a long message is exactly where both the cost and the value are.
   */
  const pendingDraftRef = useRef<ChannelDraft | null>(null);
  useEffect(() => {
    const draft: ChannelDraft = {
      text: value,
      reply: replyQuote,
      attachments: draftFiles,
    };
    pendingDraftRef.current = draft;
    const timer = window.setTimeout(() => {
      pendingDraftRef.current = null;
      saveChannelDraft(viewerId, channel.uuid, draft);
    }, DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [viewerId, channel.uuid, value, replyQuote, draftFiles]);

  /**
   * THE FLUSH IS NOT OPTIONAL. A debounce alone would lose whatever was typed
   * between the last write and the tab closing — the exact event this whole
   * feature exists for, made slightly likelier by the debounce that was supposed
   * to be free. `pagehide` is the one that fires for a closing tab, a
   * navigation away AND a page frozen into the back/forward cache; the cleanup
   * covers the composer merely unmounting (leaving the channel, signing out).
   *
   * Declared AFTER the timer effect so React tears down in that order: the
   * pending timer is cleared first, then this writes what it was holding. The
   * closure's `viewerId` / `channel.uuid` are the ones the pending draft was
   * built for, because a cleanup runs before the next effect's setup.
   */
  useEffect(() => {
    const flush = () => {
      const draft = pendingDraftRef.current;
      if (draft === null) return;
      pendingDraftRef.current = null;
      saveChannelDraft(viewerId, channel.uuid, draft);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [viewerId, channel.uuid]);

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

  /**
   * A message that failed to send in an EARLIER session, brought back off the
   * device by `../send-outbox.ts`.
   *
   * IT IS RESTORED AND IT IS INVISIBLE, which is why this line exists. The feed
   * merges outbox rows at their true `created_at` — the only honest place for
   * them — so a send that failed yesterday sits at the top of a freshly loaded
   * newest page while the reader lands at the bottom, and "never silently
   * dropped" holds in the store while failing completely for the person it was
   * written for. Restamping it to now would put a yesterday message under a
   * conversation it was not part of, so the row keeps its instant and the
   * composer says the row is there and offers to go.
   *
   * Only failures from a PREVIOUS session qualify; one this tab watched fail is
   * already where the reader was looking.
   */
  const restoredFailures = useRestoredFailures(channel.uuid);
  const [failureNoticeDismissed, setFailureNoticeDismissed] = useState(false);
  const restoredFailureNotice = useMemo(() => {
    let oldest = restoredFailures[0];
    if (oldest === undefined) return null;
    // The jump lands on the one furthest UP the transcript, because that is the
    // one the reader will never scroll to; the rest are between it and them.
    // Chosen by its INSTANT rather than by its place in the store — a retry that
    // fails again is re-recorded at the end while staying the oldest message.
    for (const row of restoredFailures) {
      if (Date.parse(row.createdAt) < Date.parse(oldest.createdAt)) oldest = row;
    }
    return {
      localUuid: oldest.localUuid,
      text:
        restoredFailures.length === 1
          ? "A message from earlier wasn't sent."
          : `${restoredFailures.length} messages from earlier weren't sent.`,
      action: restoredFailures.length === 1 ? 'Show it' : 'Show the oldest',
    };
  }, [restoredFailures]);
  const restoredFailureOpen = restoredFailureNotice !== null && !failureNoticeDismissed;

  /** Is the picker actually ON SCREEN? A pending `@token` that matches nobody
   *  and explains nobody shows nothing, and Escape must not be swallowed by an
   *  invisible surface — the reply bar behind it is what the reader meant. */
  const pickerOpen = mention !== null && (suggestions.length > 0 || untaggable !== '');

  /**
   * What a restored draft could not bring back, in one sentence. DERIVED, never
   * state: it is a fact about the check's answer, so there is nothing to keep in
   * step with and nothing to set from an effect. The files are still in the
   * channel's library in the failure case, which is the only useful thing left
   * to tell someone whose chip has gone.
   */
  const restoreProblem = useMemo(() => {
    if (savedFiles.length === 0) return null;
    if (restoreCheck.failed) {
      return "Couldn't check the files saved with this draft, so they weren't attached. They're still in this channel's files.";
    }
    // Only files the reader has NOT already taken off the message: naming one
    // they removed themselves would report their own decision back to them as
    // a problem.
    const armed = new Set(savedFiles.map((entry) => entry.id));
    const gone = restoreCheck.missing.filter((entry) => armed.has(entry.id));
    if (gone.length === 1) {
      return `${gone[0].name} isn't in this channel's files any more, so it wasn't attached.`;
    }
    if (gone.length > 1) {
      return `${gone.length} files saved with this draft aren't in this channel's files any more, so they weren't attached.`;
    }
    return null;
  }, [restoreCheck.failed, restoreCheck.missing, savedFiles]);
  /**
   * THE SENTENCE OUTLIVES THE SEND. Sending clears `savedFiles`, which is what
   * the line above is derived FROM — so the explanation for the files that
   * didn't make it collapsed in the same beat as the message posting, and the
   * only reader who never got to read it is the one it was written for. So a
   * send that happens while it is on screen LATCHES it here, and it stays until
   * the reader dismisses it like any other notice. Set from the send handler,
   * never from an effect: it is a thing that happened, not a thing derived.
   */
  const [problemAfterSend, setProblemAfterSend] = useState<string | null>(null);
  const restoreProblemText = restoreProblem ?? problemAfterSend;
  const restoreProblemOpen = restoreProblemText !== null && !restoreNoticeDismissed;

  /**
   * The staging tray as ONE list, in the order the send will carry them.
   *
   * A chip is a chip: same geometry, same name, same size, whether it came off
   * an upload or out of a saved draft — which is why the draft keeps the name
   * and size rather than the id alone. `checking` is the only difference the
   * reader sees, and it is a state of the same row rather than a second kind of
   * row, so nothing shifts by a pixel when the library answers.
   */
  const trayChips = useMemo<readonly TrayChip[]>(() => {
    const rows: TrayChip[] = [];
    if (restoreChecking) {
      for (const entry of savedFiles) {
        rows.push({ ...entry, preview: null, checking: true });
      }
    }
    for (const entry of staged) {
      rows.push({
        id: entry.file.id,
        name: entry.file.original_name,
        size: entry.file.size,
        preview: entry.preview,
        checking: false,
      });
    }
    return rows;
  }, [restoreChecking, savedFiles, staged]);

  // Every tray row — and the typing legend — holds its last content through
  // its own fade, so nothing ever animates out while empty.
  const replyShown = useHeldValue(replyQuote);
  const aiNoticeShown = useHeldValue(aiNotice);
  const noticeShown = useHeldValue(notice);
  const restoreProblemShown = useHeldValue(
    restoreProblemOpen ? restoreProblemText : null,
  );
  // Referentially stable between store changes (the memo above reads a
  // `useSyncExternalStore` snapshot), which is `useHeldValue`'s one requirement.
  const restoredFailureShown = useHeldValue(
    restoredFailureOpen ? restoredFailureNotice : null,
  );
  const trayShown = useHeldValue(trayChips.length > 0 ? trayChips : null) ?? trayChips;
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
    //
    // THE CAP COUNTS WHAT THE READER CAN SEE, which is what `trayChips` IS. A
    // chip still being checked counts, so nothing sneaks an eleventh file past
    // the limit in the seconds before the library answers. A chip whose check
    // FAILED does not, and that is the fix: it used to count the saved ids in
    // that case too, so the paperclip refused every file for a limit that
    // nothing on screen was using and no chip existed to remove.
    let claimed = trayChips.length + uploading.length;
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

  /**
   * Un-stage one file. It stays in the channel's library — the tray says so.
   *
   * BOTH LEDGERS, EVERY TIME. A chip is either an upload from this session or
   * one a saved draft brought back, and only one of the two filters can match —
   * so asking which kind it is would be a branch that exists purely to be got
   * wrong later. A restored chip has no preview, and `revokePreview(null)` is
   * already a no-op.
   */
  const unstage = (fileId: number, preview: string | null) => {
    revokePreview(preview);
    stagedIdsRef.current.delete(fileId);
    setStagedRows((current) => current.filter((row) => row.file.id !== fileId));
    setSavedFiles((current) => current.filter((row) => row.id !== fileId));
  };

  /** Take the reply off the message — the live one AND the one a draft brought
   *  back, so cancelling never uncovers an older target underneath. */
  const cancelReply = () => {
    setSavedReply(null);
    onCancelReply();
  };

  const handleSend = () => {
    const content = value.trim();
    if (content.length > MESSAGE_MAX_LENGTH) return;
    // A send while an upload is still on the wire would post without it. The
    // button says so in its accessible name; Enter has no button to say it
    // with, so the tray does — a keystroke that does nothing and explains
    // nothing is the reader being ignored.
    if (uploading.length > 0) {
      setNotice(UPLOAD_STILL_RUNNING);
      return;
    }
    // The same refusal for the same reason, one beat earlier in the message's
    // life: a restored chip is not a file until the library has vouched for it.
    // ABOVE the empty check, because a draft of nothing but files reads as empty
    // until the answer lands, and would otherwise refuse Enter in silence.
    //
    // NOTHING IS SET HERE. This wait is on screen the whole time it applies —
    // its own tray row, in `RESTORE_STILL_CHECKING`'s own words — so answering
    // the keystroke with a second copy of the same sentence, in the alarm face,
    // would be the app repeating itself at someone who is already reading it.
    if (restoreChecking) return;
    // Files alone are a message; nothing at all is a 422 the server would
    // rightly refuse, so it never leaves here.
    if (content === '' && staged.length === 0) return;

    send.mutate(
      {
        content,
        replyToUuid: replyQuote?.uuid ?? null,
        replyToPreview: replyQuote,
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
    // What the restored draft could not bring back is still worth reading AFTER
    // the send — the line is derived from `savedFiles`, and the next statement
    // takes those away. Held here so the explanation does not leave with the
    // thing it explains.
    if (restoreProblemOpen && restoreProblemText !== null) {
      setProblemAfterSend(restoreProblemText);
    }
    // The draft is now a message. Everything it was holding goes with it —
    // including the restored half, or the next mount would offer it back.
    setSavedFiles(NO_DRAFT_FILES);
    cancelReply();
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

    if (event.key === 'Escape' && replyQuote) {
      event.preventDefault();
      cancelReply();
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
    (value.trim().length > 0 || staged.length > 0) &&
    remaining >= 0 &&
    !uploadingNow &&
    !restoreChecking;
  /** Why Send is refused, when the reason is not simply "nothing to send".
   *  It becomes the button's accessible name, because a disabled control with
   *  no explanation is a dead end for anyone who cannot see the percentage
   *  counting up two rows above it. */
  const sendBlockedReason = uploadingNow
    ? UPLOAD_STILL_RUNNING
    : restoreChecking
      ? RESTORE_STILL_CHECKING
      : null;
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

          {/* A message from a previous session that never left. It IS in the
              transcript — at the moment it was written, which is above
              everything the reader can see — so this line is the only thing
              standing between "restored" and "invisible". The row itself still
              carries Retry and Discard; this just gets the reader to it. */}
          <ComposerTrayRow open={restoredFailureOpen}>
            <ComposerNotice
              text={
                <>
                  {restoredFailureShown?.text}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      if (restoredFailureShown === null) return;
                      // Dismissed by the act of going: the reader is now looking
                      // at the row, and repeating the news over the composer they
                      // came back to type in would be the app talking to itself.
                      setFailureNoticeDismissed(true);
                      onJumpToMessage(restoredFailureShown.localUuid);
                    }}
                    className={cn(
                      'rounded font-medium text-primary underline underline-offset-2',
                      FOCUS_RING,
                    )}
                  >
                    {restoredFailureShown?.action}
                  </button>
                </>
              }
              onDismiss={() => setFailureNoticeDismissed(true)}
            />
          </ComposerTrayRow>

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

          {/* What the saved draft could not bring back. A separate row from the
              refusal notice above on purpose: this one is about the PAST — it
              is already true when the composer opens — and letting a typo's
              rejection overwrite it would take away the only explanation for a
              chip the reader can see is missing. */}
          <ComposerTrayRow open={restoreProblemOpen}>
            <ComposerNotice
              text={restoreProblemShown ?? ''}
              onDismiss={() => setRestoreNoticeDismissed(true)}
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

          {/* WHY SEND IS REFUSED, ON SCREEN, WHILE IT IS TRUE. The same sentence
              is the Send button's accessible name — and a disabled button fires
              no click and has no touch affordance for its `title`, so on a phone
              that reason was reachable only through the control it was
              explaining. A reader would meet a dead Send, pulsing chips and no
              words at all. It is a state, not a refusal, so it is not the
              `ComposerNotice` face: no alarm, nothing to dismiss, and it leaves
              the moment the library answers. */}
          <ComposerTrayRow open={restoreChecking}>
            <p className="rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
              {RESTORE_STILL_CHECKING}
            </p>
          </ComposerTrayRow>

          {/* Staged attachments — what the next send will carry.

              THE LINE UNDER THEM IS NOT A DISCLAIMER, IT IS THE FACT. An
              upload lands in the channel's library the moment it completes;
              staging only decides which message carries it. So the tray states
              that plainly while it is on screen, and offers the Files section
              as the place to go — which is also the only honest answer to
              "then how do I actually delete it?".

              A RESTORED DRAFT'S CHIPS LEAD, AND SAY THEY ARE PROVISIONAL. They
              are drawn from the record on the device — the right name and the
              right size, so nothing shifts when the real row lands — but they
              are not files yet, so they carry `aria-busy` and Send is refused
              until the library has answered for them. Un-staging one still
              works: it is the reader's draft, and waiting to be told a file
              exists is no reason to be unable to say you don't want it. */}
          <ComposerTrayRow open={trayChips.length > 0}>
            <div className="rounded-xl border bg-background px-3 py-2">
              <ul
                aria-label="Files on this message"
                className="flex flex-wrap items-center gap-1.5"
              >
                {trayShown.map((chip) => (
                  <li
                    key={chip.id}
                    aria-busy={chip.checking || undefined}
                    className={cn(
                      'inline-flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-1',
                      chip.checking && 'motion-safe:animate-pulse',
                    )}
                  >
                    {chip.preview ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- a blob: object URL for the local file; next/image cannot take one, and there is nothing to optimise. */
                      <img
                        src={chip.preview}
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
                    <span
                      className={cn(
                        'min-w-0 truncate text-xs',
                        chip.checking ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {chip.name}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                      {formatBytes(chip.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => unstage(chip.id, chip.preview)}
                      aria-label={`Don't send ${chip.name}`}
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

          {/* Reply staging bar — symmetric collapse, last content held. Reads
              the QUOTE, so a target the feed just set and one a saved draft
              brought back render through exactly the same line. */}
          <ComposerTrayRow open={replyQuote !== null}>
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs">
              <CornerUpLeft aria-hidden className="size-3.5 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate text-muted-foreground">
                Replying to{' '}
                <span className="font-medium text-foreground">{replyingToName}</span>
                {/* `replyQuoteText`, not the raw preview: replying to a message
                    made only of files would otherwise trail off after the
                    name, which reads as a bar that failed to fill in. */}
                {replyShown ? ` — ${replyQuoteText(replyShown)}` : ''}
              </p>
              <button
                type="button"
                onClick={cancelReply}
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
      rowRef={rowRef}
      actions={
        <>
          {/* `hidden` is `display: none`, so this is not a flex item and cannot
              disturb either arrangement. */}
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
        </>
      }
      trailing={
        <>
          {remaining <= COUNTER_AT && (
            <span
              aria-live="polite"
              className={cn(
                'shrink-0 text-xs tabular-nums',
                remaining < 0
                  ? 'font-medium text-destructive'
                  : 'text-muted-foreground',
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
        </>
      }
    >
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
        // `w-full`, not `flex-1`: the shell's wrapper is the flex item now, and
        // it is what widens to the full row once the message outgrows one line.
        //
        // `block` IS LOAD-BEARING, and its absence was a real defect rather
        // than a style. A `<textarea>` is inline-level by default, so it sat on
        // a line box in its wrapper and the wrapper reserved the font's DESCENT
        // under it — measured 2026-08-06, six phantom pixels below the box on
        // every arrangement. They made the row six pixels taller than the box it
        // contains, and because the row is `items-end` they also pushed the
        // three verbs six pixels BELOW the text they sit beside on one line.
        //
        // `px-2`, NOT `px-1`, because the composer already HAS a content inset
        // and the input was not using it: the row's `p-1.5` plus the 8px a
        // `size-4` glyph is centred by inside a `size-8` control puts every icon
        // in this surface — paperclip, mention, emoji, Send — at 14px from the
        // edge. 4px of padding put the words at 10px, so expanded (where the
        // text sits directly above the verbs) the block read ragged. 8px is that
        // same 14px, and both edges of the surface now have ONE inset.
        className="block max-h-[200px] min-h-8 w-full resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
      />
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
