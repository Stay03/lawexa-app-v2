import type {
  Channel,
  Member,
  Message,
  MessageReplyTo,
  SlimUser,
} from '@/types/collab';
import {
  QUIET_GRAMMAR,
  type UnreadGrammar,
} from '@/v2/features/collab/unread-grammar';
import { channelDisplayName } from './thread-model';

/**
 * channels model — the pure vocabulary of the W2 channel screen: tab parsing,
 * permissions, upload rules, and the mention-candidate shape. No JSX, no
 * hooks, no browser APIs — the screen, the composer and the route shell all
 * read from here so none of them can drift on a constant. Sources: plan W2
 * items 1–7, `api-digest.md` §C/§F (2026-08-04), study verdicts A3–A6.
 */

/* ── Tabs (?tab=) ─────────────────────────────────────────────────────────── */

/** The three channel sections. Chat is the default and never written to the
 *  URL (a bare `/channels/{uuid}` IS the chat — study A3 FIX: the active tab
 *  becomes URL state so Lists/Files are addressable). */
export type ChannelTab = 'chat' | 'lists' | 'files';

/** Read the tab out of `?tab=`. Anything unrecognised resolves to Chat, so a
 *  hand-edited URL degrades to the conversation instead of an error. */
export function parseChannelTab(raw: string | null | undefined): ChannelTab {
  switch (raw) {
    case 'lists':
    case 'files':
      return raw;
    default:
      return 'chat';
  }
}

/* ── The unread grammar (DIRECTION 2, backend Ruling A) ───────────────────── */

/**
 * A CHANNEL row's grammar — shared by the in-space row and the cross-space
 * "My channels" row, which is why it belongs to the channels feature and not
 * to either screen (audit L2 moved it here from `spaces/model.ts`, where it
 * had left a channels file importing the spaces feature).
 *
 * `unread_count` / `mention_count` are members-only and kept live between
 * refetches by the spine's `.channel.unread` writers (absolute counts,
 * assigned never incremented) — which is why a row rendered from this function
 * updates within a second of a message arriving, with no refetch of its own.
 *
 * MUTE IS APPLIED HERE, ON THE CLIENT, and that is correct: the server still
 * sends a muted channel's `unread_count` (the badge must stay accurate for
 * when the member unmutes), so the row — not the payload — is where mute stops
 * the bold + dot. The mention count passes through untouched.
 */
export function channelUnreadGrammar(channel: Channel): UnreadGrammar {
  const muted = channel.my_notify_level === 'muted';
  const mentions = channel.mention_count ?? 0;
  const unread = !muted && (channel.unread_count ?? 0) > 0;
  if (!unread && mentions <= 0 && !muted) return QUIET_GRAMMAR;
  return { unread, mentions, muted };
}

/* ── Row ranking: when a room last moved (2026-08-16) ─────────────────────── */

/**
 * The fields a room is RANKED by. `Pick`ed rather than the whole `Channel` so a
 * caller can rank a row it only holds part of, and so the two functions below
 * state exactly what they read.
 */
export type RankableRoom = Pick<
  Channel,
  'last_message_at' | 'created_at' | 'is_thread' | 'title' | 'name'
>;

/**
 * When this room last MOVED: its newest message or, for a room nobody has
 * spoken in yet, the moment it was created.
 *
 * THE `?? created_at` IS THE NULL CASE, AND IT IS LOAD-BEARING. A brand-new
 * thread carries `last_message_at: null` (a standalone one may hold it for
 * days), and ranking on that field alone would sink every newborn thread to the
 * bottom of a list whose one promise is "newest first". Both thread indexes
 * (`GET /threads`, `GET /spaces/{uuid}/threads`) fall back to `created_at` for
 * exactly this row, so a merge that did not agree with them would fight the
 * server on every refetch.
 *
 * APPLIED TO BOTH KINDS ON PRINCIPLE: one list, one clock. Ranking a thread by
 * its creation and a channel by nothing at all would mean two rows sitting side
 * by side under one heading were dated by different rules. For a channel it
 * fires only when nothing was ever said there, where creation genuinely IS the
 * latest activity, and it is what lifts a channel made five minutes ago out of
 * "Earlier".
 *
 * IT LIVES HERE, beside {@link channelUnreadGrammar}, for the same reason that
 * one does (audit L2): a thread IS a channel on the wire, so the vocabulary for
 * ranking channel rows belongs to the channels feature and not to whichever
 * screen needed it first. The space lobby's digest still carries a private twin
 * of this; that copy should be deleted in favour of this one the next time that
 * file is open.
 */
export function roomActivityAt(
  room: Pick<Channel, 'last_message_at' | 'created_at'>,
): string {
  return room.last_message_at ?? room.created_at;
}

/** {@link roomActivityAt} as epoch milliseconds. An unparseable stamp scores
 *  `0`, which sorts it last rather than throwing the whole list into NaN. */
function roomActivityRank(room: Pick<Channel, 'last_message_at' | 'created_at'>): number {
  const parsed = Date.parse(roomActivityAt(room));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Newest first; ties break on the DISPLAY name, never on `name`, because a
 * thread's `name` is a machine slug nobody should sort by. For a channel the
 * two are the same string, so a channel-only list is unaffected.
 */
export function compareRoomRecency(left: RankableRoom, right: RankableRoom): number {
  const delta = roomActivityRank(right) - roomActivityRank(left);
  return delta !== 0
    ? delta
    : channelDisplayName(left).localeCompare(channelDisplayName(right));
}

/* ── Permissions ──────────────────────────────────────────────────────────── */

/** Channel governance: owner/admin may edit/delete the channel, invite, and
 *  manage roles (AC §5). */
export function canManageChannel(channel: Pick<Channel, 'my_role'>): boolean {
  return channel.my_role === 'owner' || channel.my_role === 'admin';
}

/* ── Messages ─────────────────────────────────────────────────────────────── */

/** Server-enforced content cap (AC §6). */
export const MESSAGE_MAX_LENGTH = 8000;

/** Consecutive messages from one author within this window share a header —
 *  the 5-minute grouping v1 shipped and the study marks KEEP (A4). */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** Optimistic (not-yet-acknowledged) messages carry this uuid prefix so every
 *  consumer — feed, permissions, read pointer — can tell them from real rows. */
export const LOCAL_MESSAGE_PREFIX = 'local-';

export function isLocalMessageUuid(uuid: string): boolean {
  return uuid.startsWith(LOCAL_MESSAGE_PREFIX);
}

/* ── Reactions (phase-5 W3) ───────────────────────────────────────────────── */

/**
 * The curated reaction tray — the ONLY emoji this product offers.
 *
 * A full emoji keyboard would be a dependency, a search box, a data file and a
 * grid of two thousand pictures hanging off a chat row. WhatsApp's answer is
 * the right one at this scale: a small row of the reactions people actually
 * send, which fits in a hover cluster, needs no search, and keeps a channel's
 * reaction vocabulary legible at a glance. The server accepts any valid emoji,
 * so widening this list later costs one line and breaks nothing.
 *
 * WRITTEN AS ESCAPES ON PURPOSE. Validation is grapheme-strict server-side
 * (api-digest §F.9): a lone VS16 or a stripped VS16 is a 422, and VS16 variants
 * are DISTINCT buckets from their bare codepoints — so `❤️` (U+2764 U+FE0F) and
 * `❤` are different reactions. Escapes make the exact byte sequence visible and
 * un-mangleable by an editor, a formatter or a copy-paste.
 */
export const REACTION_TRAY: readonly string[] = [
  '\u{1F44D}', // thumbs up
  '\u2764\uFE0F', // red heart - the trailing VS16 is REQUIRED (see above)
  '\u{1F602}', // face with tears of joy
  '\u{1F389}', // party popper
  '\u{1F440}', // eyes
  '\u{1F64F}', // folded hands
  '\u2705', // check mark button
  '\u{1F914}', // thinking face
];

/* ── Mentions ─────────────────────────────────────────────────────────────── */

/*
 * WHERE A `@handle` IS ALLOWED TO APPEAR (the house rule, 2026-08-05).
 *
 * A handle earns its pixels on exactly four kinds of surface:
 *  1. where a person is being CHOSEN — the composer's `@` picker and the
 *     add-people picker, which is where two "Ada Obi"s have to be told apart
 *     before one of them is picked;
 *  2. on a ROSTER ROW — the channel, space and organization member lists. This
 *     is the only place someone can LOOK UP another person's handle without
 *     already being mid-message, and two identically-named people in a roster
 *     are otherwise impossible to tell apart, which is the exact problem
 *     usernames were introduced to solve. v1's `MemberListItem` ships it, so
 *     the two codebases say the same thing (owner decision, 2026-08-05);
 *  3. where a person is being IDENTIFIED TO THEMSELVES — the account row in
 *     the shell footer, the one place a reader can learn what others must type
 *     to reach them, and the way in to changing it;
 *  4. nowhere else.
 *
 * It stays OFF author headers, avatar stacks and the space lobby's people
 * strip: those are glances, not lookups, and a handle on each would be a fact
 * nobody in that context came for, paid for by every row on the screen.
 *
 * IN THE FEED IT IS DIFFERENT AGAIN, and deliberately so. A resolved mention
 * chip renders the DISPLAY NAME, because a username is a lookup key rather
 * than a public identity — until one message tags two people who share a name,
 * at which point that chip shows the handle instead (`buildMentionChips`). The
 * roster is where you go to learn a handle; the sentence is not.
 *
 * Nobody needs to know a handle to use one: both pickers match the display name
 * as well, so the handle is only ever the tie-breaker it was built to be.
 */

/** One row of the composer's @mention autocomplete. `user: null` is the
 *  synthetic Lawexa candidate (summons the channel AI — FC §11).
 *
 *  `handle` is NON-NULLABLE on purpose: a candidate exists only if picking it
 *  produces a tag that lands. Someone who cannot be tagged is not a candidate
 *  with a missing field — they are not a candidate. See {@link MentionOptions}. */
export interface MentionCandidate {
  key: string;
  name: string;
  /** The exact string the composer writes after `@` — the member's unique
   *  `username`, which is the ONLY thing the server matches (digest §F.19). */
  handle: string;
  user: SlimUser | null;
}

/** Reserved by the synthetic AI candidate — the server refuses it as a
 *  username, so no member can shadow the summon. */
const LAWEXA_HANDLE = 'lawexa';

/** What the composer's `@` picker may offer, and who it must explain instead. */
export interface MentionOptions {
  /** Rows the picker offers. Every one of them tags someone. */
  candidates: MentionCandidate[];
  /** Display names of active members with NO handle — never offered, because
   *  no string tags them, and named in the picker's one explanatory line so
   *  their absence reads as a fact about them rather than a broken search. */
  untaggable: string[];
}

/**
 * Build the `@` picker's contents from the active roster + the synthetic
 * `lawexa` entry.
 *
 * THE HANDLE IS THE MEMBER'S USERNAME, FULL STOP (digest §F.19). Tagging used
 * to match a slug of the display name, so this built one; since 2026-08-05 the
 * server matches a unique `@username` and nothing else, and a slug tags nobody.
 *
 * THAT ALSO DELETES THE AMBIGUITY RULE THIS FUNCTION USED TO CARRY. It dropped
 * a member entirely when two display names collided, because a shared slug
 * resolved to no one — which quietly hid exactly the two people ("Ada Obi" and
 * "Ada Obi") that usernames were introduced to make reachable. Usernames are
 * unique by construction (`adaobi`, `adaobi2`), so every member with one is
 * offered, and the handle on each row is what tells them apart.
 *
 * A MEMBER WITH NO USERNAME IS NOT OFFERED. Guests never get one, and every
 * account predating the backfill has none — measured 2026-08-05: that is still
 * EVERY account in production. There is no string that tags them, so offering
 * a row would be a promise the send cannot keep. They are returned separately
 * instead: the picker names them in one quiet line, because a reader who can
 * see someone in the member list and not in the picker is owed the reason.
 */
export function buildMentionOptions(members: readonly Member[]): MentionOptions {
  const candidates: MentionCandidate[] = [];
  const untaggable: string[] = [];

  for (const member of members) {
    if (!member.is_active) continue;
    const handle = member.user.username;
    if (!handle) {
      untaggable.push(member.user.name);
      continue;
    }
    candidates.push({
      key: member.user.uuid,
      name: member.user.name,
      handle,
      user: member.user,
    });
  }

  candidates.push({ key: LAWEXA_HANDLE, name: 'Lawexa', handle: LAWEXA_HANDLE, user: null });
  return { candidates, untaggable };
}

/** How many items a list sentence names before it starts counting. */
const MAX_NAMED = 3;

/**
 * The house voice for a short list of names or handles: "A", "A and B",
 * "A, B and C", then "A, B, C and 2 others". Shared by the picker's
 * can't-be-tagged line and the feed's matched-nobody hint so the two read as
 * one product rather than two authors.
 */
function namesSentence(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length <= MAX_NAMED) {
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  }
  const rest = items.length - MAX_NAMED;
  return `${items.slice(0, MAX_NAMED).join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
}

/**
 * The picker's line for members no string can tag (see {@link MentionOptions}).
 * One entry per PERSON, so a name that stands for several of them is said once
 * and counted: without that, the very case this feature exists for — two people
 * called "Ada Obi", neither with a handle — printed as "Ada Obi, Ada Obi and
 * Bo", which reads as a bug rather than as two people. There is nothing to tell
 * them apart by yet, and that is exactly what the line is reporting.
 */
export function untaggableSentence(names: readonly string[]): string {
  if (names.length === 0) return '';
  const perName = new Map<string, number>();
  for (const name of names) perName.set(name, (perName.get(name) ?? 0) + 1);
  const items = [...perName].map(([name, count]) =>
    count > 1 ? `${name} ×${count}` : name,
  );
  return `${namesSentence(items)} can't be tagged yet — no handle.`;
}

/**
 * The writer-only line under their OWN message when `@tokens` matched nobody
 * (`metadata.unmatched_handles`, digest §F.19).
 *
 * A HINT, NOT A FAILURE, and the copy has to earn that: the message posted, and
 * ordinary text is full of `@` — an email address, `@Override` in a code paste.
 * So it states what happened and stops. No apology, no verb, no red.
 *
 * Handles are unique strings, so the same one typed twice is ONE thing that
 * did not match and is named once.
 */
export function unmatchedHandlesSentence(handles: readonly string[]): string {
  if (handles.length === 0) return '';
  const unique = [...new Set(handles)];
  return `${namesSentence(unique.map((handle) => `@${handle}`))} didn't match anyone in this channel.`;
}

/** Whether a message personally @mentions the viewer — drives the gold
 *  self-mention wash (design-research DIRECTION 2/3; audit §8 item 6). */
export function mentionsViewer(
  mentions: readonly { uuid: string }[],
  viewerUuid: string | null,
): boolean {
  if (!viewerUuid) return false;
  return mentions.some((mention) => mention.uuid === viewerUuid);
}

/* ── Files (digest §C Files + §F.10) ──────────────────────────────────────── */

/** The server's upload allow-list (content-sniffed server-side — a renamed
 *  .exe still 422s; this client check only saves a round trip). */
export const FILE_ALLOWED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'rtf',
  'csv',
  'xlsx',
  'pptx',
  'zip',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
] as const;

/** 15 MB server cap. */
export const FILE_MAX_SIZE_BYTES = 15 * 1024 * 1024;

/** `accept` attribute for the hidden file input. */
export const FILE_ACCEPT_ATTR = FILE_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

/**
 * The extension to give a file that arrives without a usable one — which is
 * every screenshot on the clipboard.
 *
 * Only the types the allow-list already accepts appear here: this hands a
 * nameless file the name it should have had, it never widens what may be sent.
 */
const PASTED_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * Name a file that came off the clipboard, so the rest of the pipeline can
 * treat it exactly like a picked one.
 *
 * A COPIED SCREENSHOT HAS NO NAME, and `validateChannelFile` reads the
 * extension off the name — so without this a paste is refused with the
 * nonsense sentence `"" isn't a supported file type.` The backend is explicit
 * that it sniffs the content and does not care what a file is called
 * (2026-08-05), so the name is ours to choose and only has to be honest and
 * readable in the Files tab afterwards.
 *
 * A file that already has an allowed extension is returned UNTOUCHED — copying
 * `contract.pdf` out of a folder should keep its name. A type we cannot place
 * is also returned untouched, so it meets the ordinary refusal under its own
 * name rather than a name we invented for it.
 */
function nameClipboardFile(file: File, index: number, total: number): File {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  if (file.name && (FILE_ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    return file;
  }
  const guessed = PASTED_EXTENSIONS[file.type.toLowerCase()];
  if (!guessed) return file;

  const kind = file.type.startsWith('image/') ? 'image' : 'file';
  // Numbered only when one paste carried several, so the ordinary case is a
  // clean "pasted-image.png" rather than "pasted-image-1.png".
  const suffix = total > 1 ? `-${index + 1}` : '';
  return new File([file], `pasted-${kind}${suffix}.${guessed}`, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

/**
 * The files carried by a paste (or a drop), named and ready to upload. Empty
 * for an ordinary text paste, which must be left completely alone.
 *
 * `files` is read first because it is what a file copied out of a folder
 * arrives in; `items` is the fallback that carries a screenshot. Reading both
 * is not belt-and-braces — the two clipboard shapes genuinely differ.
 */
export function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const carried =
    data.files.length > 0
      ? Array.from(data.files)
      : Array.from(data.items)
          .filter((item) => item.kind === 'file')
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null);

  return carried.map((file, index) => nameClipboardFile(file, index, carried.length));
}

/** Client-side pre-validation: an error sentence naming the file and the
 *  reason, or `null` when the file may be sent. The server stays authoritative. */
export function validateChannelFile(file: File): string | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (!(FILE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `"${file.name}" isn't a supported file type.`;
  }
  if (file.size > FILE_MAX_SIZE_BYTES) {
    return `"${file.name}" is larger than 15 MB.`;
  }
  return null;
}

/**
 * THE ARCHIVE DISCLOSURE, ONE SENTENCE, ONE HOME. It is a stated backend
 * obligation (digest §F.10) and it is now owed by two surfaces — the library
 * row and a zip attached to a message — so it lives beside the predicate that
 * decides when to say it rather than being retyped at each call site, where the
 * two copies would drift.
 */
export const ARCHIVE_NOTE =
  "Archives aren't scanned for malware — only open files from people you trust.";

/** Zip rows are download-only and carry the "archives aren't scanned" note —
 *  both stated backend obligations (digest §F.10). Content type wins;
 *  extension is the fallback for generic mimes. */
export function isArchiveFile(mimeType: string, name: string): boolean {
  const mime = mimeType.toLowerCase();
  return (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    name.toLowerCase().endsWith('.zip')
  );
}

/* ── Message attachments (backend, 2026-08-05) ────────────────────────────── */

/** Server cap on files per message. Refused client-side BEFORE the upload, so
 *  the 422 this prevents is never reachable and no file is uploaded to a
 *  message that could not have carried it. */
export const MAX_MESSAGE_ATTACHMENTS = 10;

/** "1 file" / "3 files" — how a message with no words is named. */
export function fileCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'file' : 'files'}`;
}

/**
 * What a message is QUOTED by — its own words, or, when it has none, what it
 * actually carries.
 *
 * A file-only message has `content: ""`, and every surface that previews a
 * message (the reply bar, the pins and saved panels) would otherwise render a
 * blank line the reader cannot interpret. Naming the files is the smallest
 * true thing to say instead.
 */
export function messagePreviewText(
  message: Pick<Message, 'content' | 'attachments'>,
): string {
  const text = message.content.trim();
  if (text !== '') return text;
  const count = message.attachments?.length ?? 0;
  return count > 0 ? fileCountLabel(count) : '';
}

/**
 * The same question asked of a REPLY QUOTE, which sees a different shape: a
 * server-rendered `content_preview` and a count, not the message.
 *
 * `content_preview` measured as `""` (not `null`) on a file-only target, and
 * `attachment_count` is ABSENT on every reply recorded before the deploy — so
 * an empty preview with no count is genuinely nothing to say, and returns `''`
 * rather than inventing "0 files".
 */
export function replyQuoteText(
  replyTo: Pick<MessageReplyTo, 'content_preview' | 'attachment_count'>,
): string {
  const text = replyTo.content_preview?.trim() ?? '';
  if (text !== '') return text;
  const count = replyTo.attachment_count ?? 0;
  return count > 0 ? fileCountLabel(count) : '';
}

/* ── Lists ────────────────────────────────────────────────────────────────── */

export const LIST_TITLE_MAX = 255;
export const LIST_DESCRIPTION_MAX = 5000;
export const LIST_ITEM_MAX = 1000;
export const LIST_MAX_ITEMS = 100;

/** Optimistic list items carry this prefix; a temp uuid must never enter a
 *  reorder payload (the endpoint wants the full REAL set exactly once). */
export const LOCAL_ITEM_PREFIX = 'local-item-';

export function isLocalItemUuid(uuid: string): boolean {
  return uuid.startsWith(LOCAL_ITEM_PREFIX);
}

/** List governance: the creator or channel owner/admin (LF §3). */
export function canManageList(
  list: { creator: SlimUser | null },
  channel: Pick<Channel, 'my_role'>,
  viewerUuid: string | null,
): boolean {
  return (
    (viewerUuid !== null && list.creator?.uuid === viewerUuid) ||
    canManageChannel(channel)
  );
}
