import type {
  CreateInviteLinkPayload,
  InviteMemberPayload,
  Member,
  Space,
  SpaceContentAuthor,
  SpaceKind,
  SpaceType,
  UpdateSpaceMemberRolePayload,
} from '@/types/collab';
import {
  contentRoleOf,
  isInvitableContentRole,
  type InvitableContentRole,
} from '@/v2/features/collab/membership/content-role';
import {
  SHARED_INVITE_ROLES,
  TEAM_INVITE_ROLES,
  type InviteRoleOption,
} from '@/v2/features/collab/membership/invite-roles';
import { canOpenTeamChannels } from '@/v2/features/collab/model';
import {
  QUIET_GRAMMAR,
  type UnreadGrammar,
} from '@/v2/features/collab/unread-grammar';
import type { V2SessionSnapshot } from '@/v2/runtime/session-context';

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

/* ── One Space, two kinds (Spaces F2, 11 October 2026) ────────────────────── */

/**
 * The space's kind, read ONE way everywhere. Stay decided on 11 October 2026
 * that one Space holds chats, folders and files for every member, and that
 * channels stay with the old team spaces, for researchers and above. The
 * backend stamps `kind` from B1; until that deploy the field is absent, and an
 * absent kind is `team` because that is what every space was before it. So the
 * app behaves exactly as it did until B1 lands, and nothing else here reads
 * `space.kind` directly.
 */
export function spaceKind(space: Pick<Space, 'kind'>): SpaceKind {
  return space.kind === 'shared' ? 'shared' : 'team';
}

/** A `shared` space: the new Space. Always private, never has channels. */
export function isSharedSpace(space: Pick<Space, 'kind'>): boolean {
  return spaceKind(space) === 'shared';
}

/**
 * Whether the viewer may add to the space's contents: start a chat, upload a
 * file, make a folder (design 2.4). Owner and Contributor; a Viewer only reads.
 *
 * Reads `my_content_role` ONLY, never the old `my_role`. The two are separate
 * columns on purpose (a team space's admin is not thereby a content Owner),
 * and the server derives the content role for old team members itself. An
 * absent role (an API before B1, or a non-member) is "no": a button that only
 * 403s is worse than none.
 */
export function canAddContent(space: Pick<Space, 'my_content_role'>): boolean {
  return space.my_content_role === 'owner' || space.my_content_role === 'editor';
}

/**
 * Whether this space shows its channels to this viewer: the Channels tab, the
 * channel rail and drawer, the lobby digest, and every channel request behind
 * them. A TEAM space, seen by someone who may open Team Channels. A shared
 * space has no channels at all, and below researcher the backend refuses every
 * channel route (B0), so either half failing means no channel surface and no
 * channel request.
 */
export function spaceShowsChannels(
  space: Pick<Space, 'kind'>,
  session: V2SessionSnapshot,
): boolean {
  return spaceKind(space) === 'team' && canOpenTeamChannels(session);
}

/**
 * Whether a space of this kind may be open to anyone. A shared space is always
 * private (the backend refuses `is_private: false` on it with a 422), so the
 * forms do not offer the choice there.
 */
export function canSpaceBeOpen(kind: SpaceKind): boolean {
  return kind === 'team';
}

/**
 * The `kind` a create sends. Only a viewer who may open Team Channels chooses;
 * everyone else sends NOTHING and the server makes a shared space (it refuses
 * `team` below researcher, so sending `shared` explicitly would only be a
 * second place to keep that rule).
 */
export function createSpaceKind(
  chosen: SpaceKind,
  canChooseKind: boolean,
): SpaceKind | undefined {
  return canChooseKind ? chosen : undefined;
}

/* ── The space page's tabs (?tab=) ────────────────────────────────────────── */

/** The space page's tab ids. `channels` holds the old lobby (about, the
 *  activity digest, people); the other three are the space's contents. */
export type SpaceTab = 'channels' | 'chats' | 'folders' | 'files';

const CONTENT_TABS: readonly SpaceTab[] = ['chats', 'folders', 'files'];
const TEAM_TABS: readonly SpaceTab[] = ['channels', ...CONTENT_TABS];

export const SPACE_TAB_LABELS: Readonly<Record<SpaceTab, string>> = {
  channels: 'Channels',
  chats: 'Chats',
  folders: 'Folders',
  files: 'Files',
};

/** The tabs this viewer gets: the contents for every member, and Channels
 *  first when the space shows its channels ({@link spaceShowsChannels}). */
export function spaceTabs(showsChannels: boolean): readonly SpaceTab[] {
  return showsChannels ? TEAM_TABS : CONTENT_TABS;
}

/**
 * The tab a bare `/spaces/{uuid}` opens on. A team space seen by a researcher
 * keeps the lobby it always opened on, so nothing changes for the team;
 * everyone else lands on the chats.
 */
export function defaultSpaceTab(showsChannels: boolean): SpaceTab {
  return showsChannels ? 'channels' : 'chats';
}

/**
 * Read `?tab=` against the tabs this viewer actually has. Anything else, a
 * hand-edited value or `channels` on a space that shows none, resolves to the
 * default, so a copied link never lands on a tab that is not there.
 */
export function parseSpaceTab(
  raw: string | null | undefined,
  showsChannels: boolean,
): SpaceTab {
  const tabs = spaceTabs(showsChannels);
  return tabs.find((tab) => tab === raw) ?? defaultSpaceTab(showsChannels);
}

/**
 * "3 chats · 1 folder · 2 files": what a space holds, for its row in the
 * list. Zeros are left out, so a space with only files says only that.
 * `"Nothing added yet"` when every count is known and zero, and `null` when
 * the payload carries none of them (an API before B1), so the row falls back
 * to what it showed before rather than claiming an empty space.
 */
export function spaceContentCountsLabel(
  space: Pick<Space, 'conversations_count' | 'folders_count' | 'files_count'>,
): string | null {
  const counts: readonly [number | undefined, string, string][] = [
    [space.conversations_count, 'chat', 'chats'],
    [space.folders_count, 'folder', 'folders'],
    [space.files_count, 'file', 'files'],
  ];
  if (counts.every(([count]) => count === undefined)) return null;
  const parts = counts
    .filter(([count]) => (count ?? 0) > 0)
    .map(([count, one, many]) => `${count} ${count === 1 ? one : many}`);
  return parts.length > 0 ? parts.join(' · ') : 'Nothing added yet';
}

/**
 * Whose chat a space's Chats row is: the owner's name, or "You" for the
 * viewer's own. `null` when the row carries no author, so the row simply has
 * no second line rather than a placeholder.
 */
export function spaceChatByline(
  author: SpaceContentAuthor | null | undefined,
  viewerId: number | null,
): string | null {
  if (!author) return null;
  if (viewerId !== null && author.id === viewerId) return 'You';
  return author.name.trim() || null;
}

/**
 * Whether a spaces-list row wears the quiet "Team" mark: the row SAYS it is a
 * team space (an absent kind, every row before B1, is not enough), and the
 * viewer may open Team Channels. Below researcher a team space shows no
 * channels, so the word would name something they cannot open.
 */
export function showsTeamMark(
  space: Pick<Space, 'kind'>,
  canOpenTeamChannels: boolean,
): boolean {
  return space.kind === 'team' && canOpenTeamChannels;
}

/**
 * The loaded pages of a space's list as ONE run of rows, each row once, the
 * FIRST copy kept. The three content lists page by offset while other
 * members add to the space, so an insert between two page reads shifts a row
 * from page 1 onto page 2 and it arrives twice: a doubled row on screen and a
 * duplicate React key (fix after review, 11 October 2026). The first copy is
 * the one already on screen, so keeping it moves nothing.
 */
export function uniqueRowsById<Row, Id>(
  pages: readonly { data: readonly Row[] }[],
  idOf: (row: Row) => Id,
): Row[] {
  const seen = new Set<Id>();
  const rows: Row[] = [];
  for (const page of pages) {
    for (const row of page.data) {
      const id = idOf(row);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
    }
  }
  return rows;
}

/* ── The unread grammar (DIRECTION 2, backend Ruling A) ───────────────────── */

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
  if (!unread && mentions <= 0) return QUIET_GRAMMAR;
  return { unread, mentions, muted: false };
}

/* A CHANNEL row's grammar lives with the channels feature
   (`v2/features/channels/model.ts`): both derivations share the vocabulary in
   `v2/features/collab/unread-grammar.ts`, and neither feature imports the
   other (audit L2). */

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

/* ── Membership on a shared space (Spaces F7, 12 October 2026) ────────────── */

/**
 * The fields a membership ruling reads: the kind, and both role columns.
 * `my_role` may come from the roster rather than the row (see `roleInRoster`),
 * which is why this is a shape and not the whole `Space`.
 */
export type MembershipSubject = Pick<Space, 'kind' | 'my_role' | 'my_content_role'>;

/**
 * Who may invite, change roles, make invite links, see the waiting list and
 * remove members. On a SHARED space only the content Owner (backend B2: an
 * Contributor or Viewer gets 403), read off `my_content_role`. On a TEAM space,
 * exactly today's rule: owner or admin off the old `my_role`.
 */
export function canManageMembership(space: MembershipSubject): boolean {
  return isSharedSpace(space)
    ? space.my_content_role === 'owner'
    : canManageSpace(space);
}

/** The member who may transfer ownership and delete: the content Owner on a
 *  shared space, the old owner on a team space. */
export function isMembershipOwner(space: MembershipSubject): boolean {
  return isSharedSpace(space)
    ? space.my_content_role === 'owner'
    : isSpaceOwner(space);
}

/** The viewer's content role read off a roster, for the first frame before or
 *  instead of the row's own stamp; `null` when the viewer is not on it. */
export function contentRoleInRoster(
  members: readonly Member[],
  viewerUuid: string | null,
): Member['content_role'] | null {
  if (!viewerUuid) return null;
  const self = members.find((member) => member.user.uuid === viewerUuid);
  return self ? contentRoleOf(self) : null;
}

/** The roles the invite dialog offers for this kind of space. */
export function inviteRoleOptions(kind: SpaceKind): readonly InviteRoleOption[] {
  return kind === 'shared' ? SHARED_INVITE_ROLES : TEAM_INVITE_ROLES;
}

/**
 * The invite request for a chosen role. A SHARED space sends `content_role`
 * beside `role: 'member'`, the old column the backend writes for a Contributor or
 * a Viewer (design 2.1); a TEAM space sends today's `role` and nothing else.
 * Returns `null` for a role this kind of space does not have, so a stale form
 * value can never send a mixed request.
 */
export function invitePayload(
  kind: SpaceKind,
  email: string,
  role: string,
): InviteMemberPayload | null {
  if (kind === 'shared') {
    return isInvitableContentRole(role)
      ? { email, role: 'member', content_role: role }
      : null;
  }
  return role === 'admin' || role === 'member' ? { email, role } : null;
}

/** A shared space's role change: the content role only (backend B2). */
export function contentRoleChangePayload(
  next: InvitableContentRole,
): UpdateSpaceMemberRolePayload {
  return { content_role: next };
}

/**
 * An invite link request. A SHARED space names the content role and NEVER a
 * channel (backend B2 answers 422 to one); a TEAM space keeps today's request,
 * with its channel when the link is for one.
 */
export function inviteLinkPayload(
  kind: SpaceKind,
  options: {
    requiresApproval: boolean;
    channelUuid?: string;
    contentRole?: InvitableContentRole;
  },
): CreateInviteLinkPayload {
  if (kind === 'shared') {
    return {
      requires_approval: options.requiresApproval,
      content_role: options.contentRole ?? 'viewer',
    };
  }
  return {
    requires_approval: options.requiresApproval,
    ...(options.channelUuid ? { channel_uuid: options.channelUuid } : {}),
  };
}

/**
 * Whether the viewer is the LAST content Owner of a shared space. Backend B2
 * refuses that leave with a 409 (delete the space or transfer first), so the
 * sheet says so before the request instead of after it. Team spaces keep their
 * own rule (`isOwnerMustTransferError`), so this is always `false` there.
 */
export function isLastSharedOwner(
  space: Pick<Space, 'kind'>,
  members: readonly Member[],
  viewerUuid: string | null,
): boolean {
  if (!isSharedSpace(space) || !viewerUuid) return false;
  const owners = members.filter(
    (member) => member.is_active && contentRoleOf(member) === 'owner',
  );
  return owners.length > 0 && owners.every((member) => member.user.uuid === viewerUuid);
}

/** The shared-space leave refusal (backend B2): the last Owner, 409. Keyed on
 *  the status, like the team rule above. */
export function isLastOwnerLeaveError(status: number): boolean {
  return status === 409;
}
