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

/* ── Mentions ─────────────────────────────────────────────────────────────── */

/** One row of the composer's @mention autocomplete. `user: null` is the
 *  synthetic Lawexa candidate (summons the channel AI — FC §11). */
export interface MentionCandidate {
  key: string;
  name: string;
  handle: string;
  user: SlimUser | null;
}

/**
 * Build the autocomplete candidates from the active roster + the synthetic
 * `lawexa` entry. Handles use the DOTTED form (name lowercased, spaces → `.`)
 * — one of the two server-resolvable forms (digest §F.15); the parser
 * (`lib/utils/collab.ts`) accepts both.
 */
export function buildMentionCandidates(members: readonly Member[]): MentionCandidate[] {
  const candidates: MentionCandidate[] = members
    .filter((member) => member.is_active)
    .map((member) => ({
      key: member.user.uuid,
      name: member.user.name,
      handle: member.user.name.toLowerCase().trim().replace(/\s+/g, '.'),
      user: member.user,
    }));
  candidates.push({ key: 'lawexa', name: 'Lawexa', handle: 'lawexa', user: null });
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
