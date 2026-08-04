import {
  Briefcase,
  Building2,
  GraduationCap,
  Hash,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import type {
  ChannelInvitation,
  OrganizationInvitation,
  SlimUser,
  SpaceInvitation,
} from '@/types/collab';
import type { InvitationKind } from './mutations';

/**
 * invitations row-model — the pure mapping from three unrelated payloads onto
 * ONE row shape (the `bookmarks/bookmark-row-model.ts` pattern). No JSX, no
 * hooks: the row component renders a model and knows nothing about which
 * endpoint produced it, so the three sections cannot drift into three
 * different row designs.
 *
 * THE `id` FIELD IS THE MEMBER ROW's INTEGER ID — the accept/decline path
 * parameter, and the one deliberate exception to the uuid-only member surface
 * (digest §F.4). It is carried here so no call site ever has to remember which
 * of the several ids on an invitation payload is the right one.
 *
 * Phase-5 W4, 2026-08-04.
 */

export interface InvitationRowModel {
  /** Stable identity across the three sections — also the exiting-row key. */
  key: string;
  kind: InvitationKind;
  /** The MEMBER ROW's integer id: the accept / decline path parameter. */
  id: number;
  icon: LucideIcon;
  /** What you are being invited to. */
  title: string;
  /** Where it sits, or what it is — the quiet second fact. */
  context: string | null;
  /** The role being offered ("Member", "Admin"). */
  roleLabel: string;
  invitedBy: SlimUser | null;
  /** ISO — rendered as a relative age. */
  createdAt: string;
  /** Where accepting lands the reader; `null` when there is nowhere to go
   *  (an organization is a membership, not a place with channels). */
  href: string | null;
  /** The sentence announced after a successful accept. */
  acceptedLabel: string;
}

export function organizationInvitationRow(
  invitation: OrganizationInvitation,
): InvitationRowModel {
  return {
    key: `organization:${invitation.id}`,
    kind: 'organization',
    id: invitation.id,
    icon: Building2,
    title: invitation.organization.name,
    context: invitation.organization.type_label,
    roleLabel: invitation.role_label || invitation.role,
    invitedBy: invitation.invited_by,
    createdAt: invitation.created_at,
    href: '/organization',
    acceptedLabel: `Joined ${invitation.organization.name}`,
  };
}

export function spaceInvitationRow(invitation: SpaceInvitation): InvitationRowModel {
  return {
    key: `space:${invitation.id}`,
    kind: 'space',
    id: invitation.id,
    icon: invitation.space.type === 'study' ? GraduationCap : Briefcase,
    title: invitation.space.name,
    context: invitation.space.description,
    roleLabel: invitation.role_label || invitation.role,
    invitedBy: invitation.invited_by,
    createdAt: invitation.created_at,
    href: `/spaces/${invitation.space.uuid}`,
    acceptedLabel: `Joined ${invitation.space.name}`,
  };
}

export function channelInvitationRow(
  invitation: ChannelInvitation,
): InvitationRowModel {
  return {
    key: `channel:${invitation.id}`,
    kind: 'channel',
    id: invitation.id,
    icon: invitation.channel.visibility === 'private' ? Lock : Hash,
    title: invitation.channel.name,
    context: `in ${invitation.channel.space.name}`,
    roleLabel: invitation.role_label || invitation.role,
    invitedBy: invitation.invited_by,
    createdAt: invitation.created_at,
    href: `/channels/${invitation.channel.uuid}`,
    acceptedLabel: `Joined ${invitation.channel.name}`,
  };
}
