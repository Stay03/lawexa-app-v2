import type {
  ContentRole,
  CreateInviteLinkPayload,
  InviteMemberPayload,
  Member,
  Space,
  SpaceContentAuthor,
  SpaceKind,
  SpaceType,
  UpdateSpaceMemberRolePayload,
} from '@/types/collab';
import type { ConversationMessagePreview } from '@/types/chat';
import { plainPreview } from '@/v2/features/conversations/plain-preview';
import {
  CONTENT_ROLE_LABELS,
  contentRoleOf,
  isInvitableContentRole,
  type InvitableContentRole,
} from '@/v2/features/collab/membership/content-role';
import type { InviteIdentifier } from '@/v2/features/collab/membership/invite-identifier';
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
 * Whether a space of this kind may be public. Both may, since public shared
 * spaces arrived (Arthur, 15 October 2026: listed on Discover, people ask to
 * join and the Owner approves). Before that a shared space was always private
 * and the backend answered `is_private: false` with a 422.
 */
export function canSpaceBeOpen(kind: SpaceKind): boolean {
  return kind === 'shared' || kind === 'team';
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

/* ── The space home's pills (?tab=) ───────────────────────────────────────── */

/** The space home's pills (design B4, Arthur and Stay, 17 October 2026): one
 *  list of everything (`all`), one kind of it, or the members and, for whoever
 *  manages them, the invited and the asked-to-join (`people`). Channels are
 *  not a pill: the space rail keeps them. */
export type SpaceTab = 'all' | 'conversations' | 'files' | 'folders' | 'people';

/** The pills, in the order the home draws them. */
export const SPACE_TABS: readonly SpaceTab[] = ['all', 'conversations', 'files', 'folders', 'people'];

export const SPACE_TAB_LABELS: Readonly<Record<SpaceTab, string>> = {
  all: 'All',
  conversations: 'Conversations',
  files: 'Files',
  folders: 'Folders',
  people: 'People',
};

/** The pill a bare `/spaces/{uuid}` opens on: everything in the space, with
 *  the message box under it. */
export function defaultSpaceTab(): SpaceTab {
  return 'all';
}

/**
 * Read `?tab=`. Anything that is not a pill resolves to All, so a copied link
 * never lands on nothing. That includes the two ids the tab strip used to
 * write: `channels` (the old lobby) and `chats` (the old Conversations tab,
 * the page every space opened on), which both now open the one list.
 */
export function parseSpaceTab(raw: string | null | undefined): SpaceTab {
  return SPACE_TABS.find((tab) => tab === raw) ?? defaultSpaceTab();
}

/**
 * "3 conversations · 1 folder · 2 files": what a space holds, for its row in
 * the list, in the tab's own words (design round 1: the tab is Conversations,
 * so the count is too). Zeros are left out, so a space with only files says
 * only that.
 * `"Nothing added yet"` when every count is known and zero, and `null` when
 * the payload carries none of them (an API before B1), so the row falls back
 * to what it showed before rather than claiming an empty space.
 */
export function spaceContentCountsLabel(
  space: Pick<Space, 'conversations_count' | 'folders_count' | 'files_count'>,
): string | null {
  const counts: readonly [number | undefined, string, string][] = [
    [space.conversations_count, 'conversation', 'conversations'],
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
 * A space's chat row's second line: its last message and who sent it (Stay,
 * 15 October 2026: "replace 'you' with the last message in the chat and the
 * person that sent it"). "Ada Obi: Can a tenant withhold rent…", "You: …" for
 * the reader's own, "Lawexa: …" for an answer. A sender the server withholds
 * (null) leaves the preview alone; no preview (an empty chat, or an API before
 * it) gives null, and the row falls back to whose chat it is.
 */
export function lastMessageLine(
  last: ConversationMessagePreview | null | undefined,
  viewerUuid: string | null,
): string | null {
  // Plain text: an answer's preview is markdown, and its marks read as noise in a row.
  const preview = last?.preview ? plainPreview(last.preview) : '';
  if (!last || !preview) return null;
  const who =
    last.role === 'assistant'
      ? 'Lawexa'
      : last.author
        ? viewerUuid !== null && last.author.uuid === viewerUuid
          ? 'You'
          : last.author.name.trim() || null
        : null;
  return who ? `${who}: ${preview}` : preview;
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
 * The kind a space is named by in the Move to space picker (techlead, 12
 * October 2026: team spaces stay in the picker, and each row says which kind
 * it is). The word "Team" follows `showsTeamMark`: an explicit kind and a
 * viewer with Team Channels, so a regular user's own Work space is never named
 * after something they cannot open. An absent kind says nothing.
 */
export function spaceKindMark(
  space: Pick<Space, 'kind'>,
  canOpenTeamChannels: boolean,
): 'Team' | 'Shared' | null {
  if (space.kind === 'shared') return 'Shared';
  return showsTeamMark(space, canOpenTeamChannels) ? 'Team' : null;
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

/**
 * The organisation a space belongs to, or `null` when it belongs to none.
 * It used to fall back to the word "Personal", which sat beside the type as a
 * second kind ("Work · Personal") and contradicted "shared" on a space of four
 * people (design round 1, 12 October 2026). A space with no organisation now
 * says nothing here; `MetaLine` drops the `null`.
 */
export function spaceOwnerLabel(space: Pick<Space, 'organization'>): string | null {
  return space.organization?.name ?? null;
}

/**
 * Whether a space's lock means anything. A SHARED space is always private (the
 * backend refuses anything else), so a lock on every one of them says nothing;
 * only a team space, which may be open, shows it.
 */
export function showsPrivateMark(space: Pick<Space, 'kind' | 'is_private'>): boolean {
  return !isSharedSpace(space) && space.is_private;
}

/**
 * The line under the space's name in its header: the type, then whether it is
 * private ("Study · Private"), the words the spaces list uses. Arthur, 15
 * October 2026: the name leads, these two follow, and the viewer's role is the
 * People tab's to show, not the header's. Read off `is_private` alone: a
 * shared space may be public since public shared spaces arrived (Arthur, 15
 * October 2026), so its kind says nothing about it any more.
 */
export function spaceHeaderFacts(
  space: Pick<Space, 'type_label' | 'kind' | 'is_private'>,
): [string, string] {
  const isPrivate = space.is_private;
  return [space.type_label, isPrivate ? 'Private' : 'Public'];
}

/**
 * The viewer's content role in any kind of space, the one reading every role
 * word below comes from. A shared space states it (`my_content_role`) and is
 * never guessed: its Viewer has the old `my_role` "member", which would read as
 * a Contributor. A team space states it too from B1, the server deriving it
 * from the old role; on a row without it, it is derived here the same way
 * (`contentRoleOf`: the owner is the Owner, an admin or member a Contributor).
 * `null` when neither column is known.
 */
export function viewerContentRole(space: MembershipSubject): ContentRole | null {
  if (space.my_content_role) return space.my_content_role;
  if (isSharedSpace(space) || !space.my_role) return null;
  return contentRoleOf({ role: space.my_role });
}

/**
 * The viewer's role as one word, "Owner", "Contributor" or "Viewer", for the
 * move picker. Every kind of space speaks the content roles, so the picker and
 * the list name the same person the same way (design round 2: the picker said
 * "Contributor" where the list said "You're a member" for one team space).
 */
export function spaceRoleWord(space: MembershipSubject): string | null {
  const role = viewerContentRole(space);
  return role ? CONTENT_ROLE_LABELS[role] : null;
}

/**
 * The viewer's place in a space, in words, for the list row and the space
 * header (design round 1: the approved row carries "your role", and a Viewer
 * should not learn they cannot add only by trying): "You're the owner",
 * "You're a contributor", "You're a viewer", built on `spaceRoleWord`'s word.
 * The role on a team space's channels and settings (admin, member) is the
 * members sheet's to show, not this line's. `null` when the role is not known,
 * so the line says nothing rather than guessing.
 */
export function spaceRoleLabel(space: MembershipSubject): string | null {
  const role = viewerContentRole(space);
  if (!role) return null;
  const word = CONTENT_ROLE_LABELS[role].toLowerCase();
  return role === 'owner' ? `You’re the ${word}` : `You’re a ${word}`;
}

/**
 * Stay's two lines for a shared space, shown under its description whether or
 * not it holds anything yet (design round 1). The first line is false for a
 * Viewer, who cannot add, so a Viewer reads who does instead. `null` on a team
 * space, which keeps the lobby it had.
 */
export function spacePrincipleLine(
  space: Pick<Space, 'kind' | 'my_content_role'>,
): string | null {
  if (!isSharedSpace(space)) return null;
  return space.my_content_role === 'viewer'
    ? 'Contributors and the owner add to this space. What’s here is organised for the whole team.'
    : 'Members can add to this space. What’s here is organised for the whole team.';
}

/** "1 member" / "4 members" — pluralised once, everywhere. */
export function memberCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

/**
 * A roster in two groups: the people who are in, and the people invited who
 * have not accepted yet. The members sheet draws them under two headings and
 * counts each, so the number it prints is the number of rows the owner sees
 * (design round 1: "4 members" over five rows read as a counting bug).
 */
export function splitRoster(members: readonly Member[]): {
  joined: Member[];
  invited: Member[];
} {
  const joined: Member[] = [];
  const invited: Member[] = [];
  for (const member of members) {
    (member.is_pending ? invited : joined).push(member);
  }
  return { joined, invited };
}

/** "4 members" / "4 members · 1 invite sent": the count line of the People tab
 *  and the members sheet (the heading was "Invited"; renamed 15 October 2026). */
export function rosterCountLabel(joined: number, invited: number): string {
  const members = memberCountLabel(joined);
  return invited > 0 ? `${members} · ${invited} ${invited === 1 ? 'invite' : 'invites'} sent` : members;
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
 * Who may ask to become a Contributor: a Viewer of a SHARED space (backend,
 * 16 October 2026: anyone else gets 422). Owners and Contributors have
 * nothing to ask for, and a team space has no content roles to ask about.
 */
export function canAskToContribute(space: MembershipSubject): boolean {
  return isSharedSpace(space) && space.my_content_role === 'viewer';
}

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
 *
 * The invitee travels as EXACTLY ONE key, `email` or `username`, on both kinds
 * (backend 6d11c84 answers 422 to two). It is copied key by key rather than
 * spread, so nothing else the caller's object carries can ride along.
 */
export function invitePayload(
  kind: SpaceKind,
  invitee: InviteIdentifier,
  role: string,
): InviteMemberPayload | null {
  const target =
    'email' in invitee ? { email: invitee.email } : { username: invitee.username };
  if (kind === 'shared') {
    return isInvitableContentRole(role)
      ? { ...target, role: 'member', content_role: role }
      : null;
  }
  return role === 'admin' || role === 'member' ? { ...target, role } : null;
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

/**
 * What "Leave space" leads to for this viewer (design round 1), so neither the
 * menu nor the members sheet offers a Leave that can only be refused:
 *  - `leave`: the plain confirmation;
 *  - `choose-new-owner`: the last Owner of a shared space with others in it,
 *    who must make one of them the owner first;
 *  - `delete-instead`: the last Owner with nobody else in it, who has no one to
 *    hand it to. Delete is what they are offered in Leave's place.
 * Known only once the roster has landed (`rosterKnown`); before that it is
 * `leave`, and the server's 409 is still read.
 */
export type SpaceLeaveRoute = 'leave' | 'choose-new-owner' | 'delete-instead';

export function spaceLeaveRoute(
  space: Pick<Space, 'kind'>,
  members: readonly Member[],
  viewerUuid: string | null,
  rosterKnown: boolean,
): SpaceLeaveRoute {
  if (!rosterKnown || !isLastSharedOwner(space, members, viewerUuid)) return 'leave';
  return othersInSpace(members, viewerUuid).length > 0
    ? 'choose-new-owner'
    : 'delete-instead';
}

/** The other people in the space: joined, active, not the viewer. The ones a
 *  sole Owner may hand the space to. */
export function othersInSpace(
  members: readonly Member[],
  viewerUuid: string | null,
): Member[] {
  return members.filter(
    (member) =>
      member.is_active && !member.is_pending && member.user.uuid !== viewerUuid,
  );
}

/* ── The space menu (design round 1) ──────────────────────────────────────── */

/** One row of the space's menu in the shell bar. */
export type SpaceMenuItem =
  | 'members'
  | 'invite-links'
  | 'waiting'
  | 'rename'
  | 'leave'
  | 'delete';

/**
 * The space menu, in order, for this viewer: the approved Members, Rename,
 * Leave, Delete as the role allows (design round 1, 12 October 2026).
 *  - every member: Members, and Leave unless it could only be refused (the
 *    last Owner of a space nobody else is in, `delete-instead`);
 *  - whoever manages membership adds Invite links, Waiting to join and
 *    Rename;
 *  - the Owner adds Delete.
 */
export function spaceMenuItems(viewer: {
  canManage: boolean;
  isOwner: boolean;
  leaveRoute: SpaceLeaveRoute;
}): SpaceMenuItem[] {
  const items: SpaceMenuItem[] = ['members'];
  if (viewer.canManage) items.push('invite-links', 'waiting', 'rename');
  if (viewer.leaveRoute !== 'delete-instead') items.push('leave');
  if (viewer.isOwner) items.push('delete');
  return items;
}

/* ── The members sheet's views (design round 1) ───────────────────────────── */

/**
 * What the members sheet shows, carried by its `?roster=` value so Back closes
 * it: the roster (`1`, the plain open), the invite links, the waiting list, or
 * the roster with the invite dialog already open over it (`invite`, from an
 * empty space's "Invite people"). Invite links and the waiting list moved in
 * here from sheets of their own, so the Owner finds them where the people are.
 */
export type MembersSheetView = 'members' | 'links' | 'requests' | 'invite';

/** The `?roster=` value each view is written as. */
export const MEMBERS_SHEET_PARAM: Readonly<Record<MembersSheetView, string>> = {
  members: '1',
  links: 'links',
  requests: 'requests',
  invite: 'invite',
};

/** Read `?roster=` back. Anything unknown is the roster itself. */
export function parseMembersSheetView(raw: string | null): MembersSheetView {
  switch (raw) {
    case 'links':
    case 'requests':
    case 'invite':
      return raw;
    default:
      return 'members';
  }
}
