import type { MessageAttachment, MessageReplyTo, MessageType, SlimUser } from '@/types/collab';

/**
 * device-store — the ONE door between this feature and `localStorage`, and the
 * ONE parser for anything it reads back. Written 2026-08-06 for the composer's
 * per-channel draft (`./composer/composer-draft.ts`) and the unsent-message
 * outbox (`./send-outbox.ts`), which are the only two things in the channels
 * feature that survive a tab close.
 *
 * ── WHY A PARSER AND NOT A CAST ────────────────────────────────────────────
 * `JSON.parse` answers `unknown`, and the honest distance between `unknown` and
 * `Message` is a check, not an `as`. What is on the device was written by A
 * VERSION OF THIS APP THAT NO LONGER EXISTS: a field we have since renamed, a
 * half-written record from a tab that was killed mid-write, or something
 * another script on the origin put there. A cast lets all three through to be
 * rendered, sent, or merged into the transcript. Every parser here rebuilds its
 * object FIELD BY FIELD and returns `null` on the first thing it does not
 * recognise — so nothing a stored record happens to carry can ride along, and
 * a caller's failure branch is the one it already has for "there was no draft".
 *
 * ── EVERY ACCESS IS GUARDED, AND SILENCE IS THE FAILURE MODE ───────────────
 * `localStorage` is not merely absent on the server: it THROWS on read in
 * Safari's private mode and on write once a quota is full. A draft is a
 * convenience layered over state that already works without it, so every path
 * here degrades to "there is no storage" rather than taking a composer down
 * with it.
 *
 * ── KEYS ARE SCOPED TO AN ACCOUNT BY CONSTRUCTION ──────────────────────────
 * Both callers build their key with {@link deviceKey}, whose owner segment is
 * the server-verified viewer id (`V2SessionSnapshot.userId`) — the same
 * identity the query cache partitions on. So on a shared computer B cannot
 * READ A's draft even before anything is cleared: B's key simply is not A's.
 * {@link forgetOtherOwners} then removes what is no longer anybody's business,
 * and is what actually takes A's words off the disk.
 *
 * ── THE SWEEP RUNS FROM THE V2 LAYOUT (2026-08-06) ─────────────────────────
 * It used to run from the channel composer, which mounts only for someone who
 * can POST — so B could sign in, read a channel they may not write in, browse
 * cases and notes for an hour, and A's drafts would still be on the device the
 * whole time. `v2/features/channels/device-sweep.tsx` mounts it beside
 * `V2CacheIdentityGuard` instead: one place, on the one edge that is always
 * crossed, whatever the next reader opens.
 *
 * ── NOTHING HERE IS KEPT FOREVER ───────────────────────────────────────────
 * A draft is one key per channel per account, and each may hold a whole
 * 8000-character message. Kept without limit they would accumulate for as long
 * as the browser profile lives, and the origin's quota is SHARED (v1 persists
 * here too) — a full quota makes every later `setItem` throw, which this module
 * swallows by design, so draft saving would stop working permanently and
 * silently. So a stamped record expires: {@link stampRecord} writes `savedAt`,
 * and the same {@link forgetOtherOwners} pass that walks every key drops
 * anything older than {@link MAX_RECORD_AGE_MS}. The policy is one draft per
 * channel, dropped 30 days after it was last touched. Records with no stamp are
 * left alone — the outbox states its own cap (`MAX_PERSISTED` in
 * `./send-outbox.ts`) and its rows are messages nobody has managed to send yet.
 */

/* ── Storage ──────────────────────────────────────────────────────────────── */

/** Everything this feature writes shares this prefix — the sweep's handle. */
const NAMESPACE = 'v2:channels:';

/**
 * `v2:channels:{what}:u{ownerId}:{scope?}`. `ownerId` is REQUIRED and there is
 * deliberately no signed-out form: a viewer with no account cannot post, so a
 * draft they cannot send is only a private sentence left on a shared machine.
 */
export function deviceKey(what: string, ownerId: number, scope?: string): string {
  return scope === undefined
    ? `${NAMESPACE}${what}:u${ownerId}`
    : `${NAMESPACE}${what}:u${ownerId}:${scope}`;
}

/** Parsed JSON at `key`, or `null` for missing / unreadable / unparseable. */
export function readStored(key: string): unknown {
  if (typeof window === 'undefined') return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    // Truncated or hand-edited — the same nothing as a missing key.
    return null;
  }
}

export function writeStored(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // No storage, or no room in it. The state is still in memory for this tab.
  }
}

export function removeStored(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do and nothing to say.
  }
}

/**
 * How long a stamped record may sit on the device after its last write. Thirty
 * days is well past any working session and well short of "forever": a draft
 * nobody has touched in a month is not a message anybody is still writing, and
 * it is still occupying room in a quota this origin shares with v1.
 */
const MAX_RECORD_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The record, with the moment it was written — the `savedAt` field the sweep
 * below expires on. A caller whose data should not outlive the reader's interest
 * in it writes through this; one whose data is kept until it is RESOLVED (the
 * outbox) does not, and the sweep leaves it alone.
 */
export function stampRecord<T extends object>(
  record: T,
): T & { readonly savedAt: number } {
  return { ...record, savedAt: Date.now() };
}

/** Is this a stamped record whose time is up? Anything unstamped is `false` —
 *  no stamp is not an old stamp. */
function isExpired(raw: unknown, now: number): boolean {
  if (!isRecord(raw)) return false;
  const savedAt = raw.savedAt;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return false;
  return now - savedAt > MAX_RECORD_AGE_MS;
}

/**
 * One pass over everything this feature owns: drop what belongs to a DIFFERENT
 * account, and drop what has simply been here too long.
 *
 * THE FIRST HALF IS A PRIVACY BOUNDARY. The key scoping already makes one reader
 * unable to open another's draft; this is what stops the words themselves
 * outliving the session on a shared computer. It runs on the v2 identity edge
 * (`v2/features/channels/device-sweep.tsx`) rather than from a composer, because
 * v2 has no sign-out of its own to hang it on and the next reader may never open
 * a channel they can post in — see the module docblock.
 *
 * THE SECOND IS THE RETENTION POLICY, and it is here because this pass already
 * has every key in its hand. A stamped record past {@link MAX_RECORD_AGE_MS}
 * goes with the rest. Both halves cost one walk of a store holding a handful of
 * keys, once per identity change.
 */
export function forgetOtherOwners(ownerId: number): void {
  if (typeof window === 'undefined') return;
  const mine = `u${ownerId}`;
  const now = Date.now();
  const doomed: string[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key === null || !key.startsWith(NAMESPACE)) continue;
      // The owner is the FOURTH segment of `v2:channels:{what}:u{id}[:scope]`.
      // Compared whole, because a `startsWith` on `u7` also matches `u77`.
      if (key.split(':')[3] !== mine) {
        doomed.push(key);
        continue;
      }
      // Mine, but stale. Reading here is safe: `getItem` does not move the
      // enumeration, and nothing is removed until the walk is over.
      if (isExpired(readStored(key), now)) doomed.push(key);
    }
  } catch {
    return;
  }
  // Collected first: removing while enumerating shifts every later index.
  for (const key of doomed) removeStored(key);
}

/* ── Shapes ───────────────────────────────────────────────────────────────── */

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

function text(raw: unknown): string | null {
  return typeof raw === 'string' ? raw : null;
}

function count(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

const MESSAGE_TYPES: readonly MessageType[] = [
  'text',
  'ai_divider',
  'quiz_game_live',
  'quiz_game_finished',
];

function messageType(raw: unknown): MessageType | undefined {
  return MESSAGE_TYPES.find((known) => known === raw);
}

export function parseSlimUser(raw: unknown): SlimUser | null {
  if (!isRecord(raw)) return null;
  const uuid = text(raw.uuid);
  const name = text(raw.name);
  if (uuid === null || name === null) return null;
  return {
    uuid,
    name,
    // `username` is nullable and its absence is the LIVE case (the backfill has
    // not run), so an unreadable one reads as "not taggable" rather than
    // refusing the whole record.
    username: text(raw.username),
    avatar_url: text(raw.avatar_url),
  };
}

/**
 * A nullable author: a stored `null` is a Lawexa or deleted-account row and is a
 * VALUE; a record we cannot read is a refusal. Collapsing the two would render
 * a real person's message as "Deleted member", which is a worse lie than
 * dropping the row.
 */
function parseAuthorField(raw: unknown): { author: SlimUser | null } | null {
  if (raw === null || raw === undefined) return { author: null };
  const author = parseSlimUser(raw);
  return author === null ? null : { author };
}

export function parseMessageReplyTo(raw: unknown): MessageReplyTo | null {
  if (!isRecord(raw)) return null;
  const uuid = text(raw.uuid);
  const authorField = parseAuthorField(raw.author);
  if (uuid === null || authorField === null) return null;
  const attachmentCount = count(raw.attachment_count);
  const type = messageType(raw.type);
  return {
    uuid,
    is_ai: raw.is_ai === true,
    author: authorField.author,
    // `null` means the target was deleted and `""` means it is files only —
    // two different sentences in `replyQuoteText`, so the distinction is kept.
    content_preview: text(raw.content_preview),
    is_deleted: raw.is_deleted === true,
    // Both are genuinely optional on the wire (older rows predate them), so an
    // absent key stays absent rather than becoming a guessed default.
    ...(type === undefined ? {} : { type }),
    ...(attachmentCount === null ? {} : { attachment_count: attachmentCount }),
  };
}

export function parseMessageAttachment(raw: unknown): MessageAttachment | null {
  if (!isRecord(raw)) return null;
  const id = count(raw.id);
  const url = text(raw.url);
  const originalName = text(raw.original_name);
  const mimeType = text(raw.mime_type);
  const size = count(raw.size);
  const category = text(raw.category);
  const uploadStatus = text(raw.upload_status);
  const createdAt = text(raw.created_at);
  if (
    id === null ||
    url === null ||
    originalName === null ||
    mimeType === null ||
    size === null ||
    category === null ||
    uploadStatus === null ||
    createdAt === null
  ) {
    return null;
  }
  return {
    id,
    url,
    original_name: originalName,
    mime_type: mimeType,
    size,
    category,
    upload_status: uploadStatus,
    created_at: createdAt,
  };
}
