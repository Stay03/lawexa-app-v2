import { type LucideIcon } from 'lucide-react';

import { channelVisibilityFace } from '@/lib/collab/visibility';
import type {
  ChannelInvitation,
  OrganizationInvitation,
  SlimUser,
  SpaceInvitation,
  SpaceType,
} from '@/types/collab';
import type { InvitationKind } from './mutations';

/**
 * invitations row-model — the pure mapping from three unrelated payloads onto
 * ONE card shape (the `bookmarks/bookmark-row-model.ts` pattern). No JSX, no
 * hooks: the card renders a model and knows nothing about which endpoint
 * produced it, so the three sections cannot drift into three different designs.
 *
 * THE `id` FIELD IS THE MEMBER ROW's INTEGER ID — the accept/decline path
 * parameter, and the one deliberate exception to the uuid-only member surface
 * (digest §F.4). It is carried here so no call site ever has to remember which
 * of the several ids on an invitation payload is the right one.
 *
 * ── WHAT THE CARD MAY SAY, VERIFIED AGAINST THE WIRE (2026-08-04) ──────────
 * The card wants to answer "what am I joining". The three payloads answer that
 * to three different depths, and this file is where that is faced honestly
 * rather than in the component:
 *  - ORGANIZATION invitations nest the FULL `Organization` — type label,
 *    verification, and the optional roster/count (`members`,
 *    `active_members_count`, both server-gated to active members, so usually
 *    absent for an invitee, which is why they are typed optional here too).
 *  - SPACE invitations nest `SpaceRef` — `{uuid, name, type, description}`.
 *    There is NO `type_label`, no member count and no channel count, so the
 *    kind is labelled from `type` here and no count is claimed.
 *  - CHANNEL invitations nest visibility, description and the parent space's
 *    name — no counts either.
 * A fact that is not on the wire is simply not in `facts`, and `MetaLine`
 * drops the gap, so no card renders a dangling separator or an empty column.
 */

/**
 * The identity mark a card leads its headline with. A channel has no crest of
 * its own — it borrows the space it lives in, which is also the thing the
 * reader is really being let into. That space arrives as `{uuid, name}` with
 * NO type, hence the third variant: a crest that carries the object's letters
 * and colour and stays silent about its kind, rather than guessing one.
 */
export type InvitationCrest =
  | { kind: 'space'; uuid: string; name: string; type: SpaceType }
  | { kind: 'organization'; uuid: string; name: string }
  | { kind: 'place'; uuid: string; name: string };

export interface InvitationRowModel {
  /** Stable identity across the three sections — also the exiting-row key. */
  key: string;
  kind: InvitationKind;
  /** The MEMBER ROW's integer id: the accept / decline path parameter. */
  id: number;
  /** What you are being invited to, by name. */
  title: string;
  /** Rendered immediately before the title — `#` for a channel, else nothing. */
  titlePrefix: string | null;
  /** A mark after the title (a private channel's lock), or `null`. */
  titleMark: LucideIcon | null;
  crest: InvitationCrest;
  /** The second line: what kind of thing this is, and anything true about it. */
  facts: readonly string[];
  /** The role being offered ("Member", "Admin"). */
  roleLabel: string;
  invitedBy: SlimUser | null;
  /** Faces for the presence stack — empty whenever the payload omits a roster. */
  memberFaces: readonly SlimUser[];
  /** The member count and its worded form, or `null` when the payload omits
   *  it. Worded here so no card ever prints a loose numeral beside the role
   *  chip — a number in this product is only ever a mention count. */
  memberCount: { total: number; words: string } | null;
  /** ISO — rendered as a relative age. */
  createdAt: string;
  /** Where accepting lands the reader; `null` when there is nowhere to go
   *  (an organization is a membership, not a place with channels). */
  href: string | null;
  /** The sentence announced after a successful accept. */
  acceptedLabel: string;
}

/** One frozen empty roster, so the two kinds that never carry faces share a
 *  reference and cannot churn a memoised card. */
const NO_FACES: readonly SlimUser[] = [];

/** `SpaceRef` carries `type` but no `type_label`, unlike `Space`. */
function spaceKindLabel(type: SpaceType): string {
  return type === 'study' ? 'Study space' : 'Work space';
}

/** Trims a description down to one honest line of context; anything longer is
 *  a page's worth of text competing with the decision. */
function shortFact(text: string | null): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return trimmed.length > 120 ? `${trimmed.slice(0, 119)}…` : trimmed;
}

/** Drops the facts the payload did not carry, keeping `facts` a plain string
 *  list the card can hand straight to `MetaLine`. */
function factsOf(...values: (string | null)[]): readonly string[] {
  return values.filter((value): value is string => value !== null);
}

/** The count with the words that make it a fact rather than a numeral. */
function memberCountOf(total: number | undefined): { total: number; words: string } | null {
  if (total === undefined) return null;
  return { total, words: `${total} ${total === 1 ? 'member' : 'members'}` };
}

export function organizationInvitationRow(
  invitation: OrganizationInvitation,
): InvitationRowModel {
  const organization = invitation.organization;
  return {
    key: `organization:${invitation.id}`,
    kind: 'organization',
    id: invitation.id,
    title: organization.name,
    titlePrefix: null,
    titleMark: null,
    crest: {
      kind: 'organization',
      uuid: organization.uuid,
      name: organization.name,
    },
    facts: factsOf(
      organization.type_label,
      organization.is_verified ? 'Verified' : null,
      shortFact(organization.bio ?? organization.description),
    ),
    roleLabel: invitation.role_label || invitation.role,
    invitedBy: invitation.invited_by,
    // Server-gated to active members, so normally absent for an invitee —
    // rendered when present rather than promised.
    memberFaces:
      organization.members
        ?.filter((member) => member.is_active)
        .map((member) => member.user) ?? NO_FACES,
    memberCount: memberCountOf(organization.active_members_count),
    createdAt: invitation.created_at,
    href: '/organization',
    acceptedLabel: `Joined ${organization.name}`,
  };
}

export function spaceInvitationRow(invitation: SpaceInvitation): InvitationRowModel {
  const space = invitation.space;
  return {
    key: `space:${invitation.id}`,
    kind: 'space',
    id: invitation.id,
    title: space.name,
    titlePrefix: null,
    titleMark: null,
    crest: { kind: 'space', uuid: space.uuid, name: space.name, type: space.type },
    facts: factsOf(spaceKindLabel(space.type), shortFact(space.description)),
    roleLabel: invitation.role_label || invitation.role,
    invitedBy: invitation.invited_by,
    memberFaces: NO_FACES,
    memberCount: null,
    createdAt: invitation.created_at,
    href: `/spaces/${space.uuid}`,
    acceptedLabel: `Joined ${space.name}`,
  };
}

export function channelInvitationRow(
  invitation: ChannelInvitation,
): InvitationRowModel {
  const channel = invitation.channel;
  // Three states, not two: a HIDDEN channel was falling to the else and being
  // labelled a plain 'Channel' with no mark at all.
  const face = channelVisibilityFace(channel.visibility);
  const isOpen = channel.visibility === 'space_public';
  return {
    key: `channel:${invitation.id}`,
    kind: 'channel',
    id: invitation.id,
    title: channel.name,
    titlePrefix: '#',
    titleMark: isOpen ? null : face.icon,
    crest: { kind: 'place', uuid: channel.space.uuid, name: channel.space.name },
    facts: factsOf(
      isOpen ? 'Channel' : `${face.title} channel`,
      `in ${channel.space.name}`,
      shortFact(channel.description),
    ),
    roleLabel: invitation.role_label || invitation.role,
    invitedBy: invitation.invited_by,
    memberFaces: NO_FACES,
    memberCount: null,
    createdAt: invitation.created_at,
    href: `/channels/${channel.uuid}`,
    acceptedLabel: `Joined ${channel.name}`,
  };
}
