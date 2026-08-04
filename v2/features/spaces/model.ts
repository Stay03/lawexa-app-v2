import type { Channel, Member, Space, SpaceType } from '@/types/collab';

/**
 * spaces model — the pure vocabulary of the W4 spaces surfaces: the type
 * filter, governance predicates, the field caps the dialogs enforce, and (the
 * load-bearing part) the ONE derivation of the unread grammar every row
 * renders. No JSX, no hooks, no browser APIs, so the list row, the channel
 * row, the space header and their skeletons all read the same answers.
 * Sources: plan W4 items 1–2, `api-digest.md` §D (Ruling A) and
 * `design-research.md` DIRECTION 2 — 2026-08-04.
 */

/* ── The All / Work / Study filter (?type=) ───────────────────────────────── */

/** The tab ids: the two space types plus the unfiltered view. */
export type SpaceFilter = 'all' | SpaceType;

/**
 * Read the filter out of `?type=`. Anything unrecognised resolves to All, so a
 * hand-edited URL shows the whole collection rather than an error — the
 * bookmarks `parseBookmarkTab` contract, applied here.
 */
export function parseSpaceFilter(raw: string | null | undefined): SpaceFilter {
  switch (raw) {
    case 'work':
    case 'study':
      return raw;
    default:
      return 'all';
  }
}

/* ── The unread grammar (DIRECTION 2, backend Ruling A) ───────────────────── */

/**
 * What a row must render, in the house's two-tier language:
 *  - `unread`   → the title goes bold AND a small gold dot appears;
 *  - `mentions` → the gold numeric badge, and ONLY mentions are ever a number;
 *  - `muted`    → the row dims and can never go bold, but a direct @you badge
 *                 still shows (mute kills notifications and the unread
 *                 rollup, never a personal mention — Ruling A, exactly).
 *
 * No red anywhere: red is reserved for failure and destructive actions.
 */
export interface UnreadGrammar {
  unread: boolean;
  mentions: number;
  muted: boolean;
}

/** A row with nothing to say — one frozen object so a quiet list of fifty
 *  rows allocates nothing and memoised rows keep their references. */
const QUIET: UnreadGrammar = { unread: false, mentions: 0, muted: false };

/**
 * A SPACE row's grammar, off the §17 rollups the list and detail payloads
 * stamp for members:
 *  - `unread_channels_count` — channels with ≥1 unread, **muted excluded**
 *    server-side; the activity dot + bold name;
 *  - `mention_count` — unread @mentions summed across the space's channels,
 *    **muted included**; the gold number.
 * Both are optional in the payload (members-only). An ABSENT field is not a
 * zero — but for the purposes of what to draw it renders the same quiet row,
 * so the fallback is deliberate and safe.
 *
 * A space is never "muted": mute is a per-channel setting, and the rollups
 * already carry its effect.
 */
export function spaceUnreadGrammar(space: Space): UnreadGrammar {
  const unread = (space.unread_channels_count ?? 0) > 0;
  const mentions = space.mention_count ?? 0;
  if (!unread && mentions <= 0) return QUIET;
  return { unread, mentions, muted: false };
}

/**
 * A CHANNEL row's grammar. `unread_count` / `mention_count` are members-only
 * and kept live between refetches by the spine's `.channel.unread` writers
 * (absolute counts, assigned never incremented) — which is why a row rendered
 * from this function updates within a second of a message arriving without any
 * refetch of its own.
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
  if (!unread && mentions <= 0 && !muted) return QUIET;
  return { unread, mentions, muted };
}

/* ── Governance ───────────────────────────────────────────────────────────── */

/** Space governance: owner/admin may edit the space, create channels, invite
 *  and manage roles (AC §4). Reads the row's stamped `my_role`. */
export function canManageSpace(space: Pick<Space, 'my_role'>): boolean {
  return space.my_role === 'owner' || space.my_role === 'admin';
}

/** Only the owner may delete the space or transfer ownership. */
export function isSpaceOwner(space: Pick<Space, 'my_role'>): boolean {
  return space.my_role === 'owner';
}

/**
 * The caller's role read off a ROSTER, for the surfaces that hold the member
 * list but not a `my_role`-stamped row (`GET /spaces/{uuid}` may omit it, and
 * organizations never stamp one at all). Returns `null` when the viewer is
 * unknown or absent from the roster.
 */
export function roleInRoster(
  members: readonly Member[],
  viewerUuid: string | null,
): Member['role'] | null {
  if (!viewerUuid) return null;
  return members.find((member) => member.user.uuid === viewerUuid)?.role ?? null;
}

/* ── Field caps (server-enforced; the dialogs mirror them) ────────────────── */

export const SPACE_NAME_MAX = 255;
export const SPACE_DESCRIPTION_MAX = 5000;
export const CHANNEL_NAME_MAX = 80;
export const CHANNEL_DESCRIPTION_MAX = 5000;

/* ── Labels ───────────────────────────────────────────────────────────────── */

/** Who owns the space: the organization's name, or "Personal". */
export function spaceOwnerLabel(space: Pick<Space, 'organization'>): string {
  return space.organization?.name ?? 'Personal';
}

/** "1 member" / "4 members" — pluralised once, everywhere. */
export function memberCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

/**
 * The owner-leave refusal: `POST /spaces/{uuid}/leave` answers **400** when the
 * caller owns the space and other members remain ("Transfer ownership…" —
 * digest §C Spaces). Keyed on the STATUS, never on the copy (§F.5's
 * anti-oracle rule): leave has exactly one 4xx refusal, so the status is the
 * discriminator and the server's own sentence is then shown verbatim.
 */
export function isOwnerMustTransferError(status: number): boolean {
  return status === 400;
}
