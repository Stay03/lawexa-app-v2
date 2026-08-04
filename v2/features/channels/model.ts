import type { Channel, Member, SlimUser } from '@/types/collab';

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

/** One row of the composer's @mention autocomplete. `user: null` is the
 *  synthetic Lawexa candidate (summons the channel AI — FC §11). */
export interface MentionCandidate {
  key: string;
  name: string;
  handle: string;
  user: SlimUser | null;
}

/** The two server-resolvable handle forms for a display name (digest §F.15):
 *  the name lowercased with spaces REMOVED, and the same with spaces → `.`.
 *  Diacritics are left exactly as typed — the server matches them literally. */
function mentionHandleForms(name: string): [squashed: string, dotted: string] {
  const lowered = name.toLowerCase().trim();
  return [lowered.replace(/\s+/g, ''), lowered.replace(/\s+/g, '.')];
}

/** Reserved by the synthetic AI candidate — a member cannot claim it. */
const LAWEXA_HANDLE = 'lawexa';

/**
 * Build the autocomplete candidates from the active roster + the synthetic
 * `lawexa` entry.
 *
 * AMBIGUOUS HANDLES ARE NOT OFFERED (W2 audit L11, digest §F.15). The server
 * resolves a handle to a member only when exactly ONE member answers to it;
 * two people who share a form make that form match NOBODY. v1 listed both of
 * them anyway, so picking either produced a message whose `@mention` silently
 * resolved to no one — it rendered as plain text and notified nobody, with
 * nothing on screen to explain why.
 *
 * So each member is offered under the first of their two forms that is
 * unambiguous across the whole active roster (dotted preferred — it reads as a
 * handle and collides less), and a member whose BOTH forms collide is left out
 * of the list entirely rather than offered as a mention that cannot work. They
 * are still reachable by every other means the channel has; what is removed is
 * only the false promise.
 */
export function buildMentionCandidates(members: readonly Member[]): MentionCandidate[] {
  const active = members.filter((member) => member.is_active);

  // Count every form across the roster, seeding the reserved AI handle so a
  // member named "Lawexa" can never shadow the summon.
  const uses = new Map<string, number>([[LAWEXA_HANDLE, 1]]);
  for (const member of active) {
    for (const form of new Set(mentionHandleForms(member.user.name))) {
      uses.set(form, (uses.get(form) ?? 0) + 1);
    }
  }

  const candidates: MentionCandidate[] = [];
  for (const member of active) {
    const [squashed, dotted] = mentionHandleForms(member.user.name);
    const handle =
      uses.get(dotted) === 1 ? dotted : uses.get(squashed) === 1 ? squashed : null;
    if (handle === null) continue;
    candidates.push({
      key: member.user.uuid,
      name: member.user.name,
      handle,
      user: member.user,
    });
  }

  candidates.push({ key: LAWEXA_HANDLE, name: 'Lawexa', handle: LAWEXA_HANDLE, user: null });
  return candidates;
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
