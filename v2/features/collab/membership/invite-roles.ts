import type { InvitableContentRole } from './content-role';

/**
 * The role lists the invite dialog offers (`InvitePeopleDialog`), kept beside
 * the dialog because two features draw it: spaces and organizations. Plain
 * words and no dashes in the labels, the owner's rule for UI copy.
 */

/** One choice in the invite dialog's role select. */
export interface InviteRoleOption<Role extends string = string> {
  value: Role;
  label: string;
}

/** A team space's and an organization's roles, as they always were. */
export const TEAM_INVITE_ROLES: readonly InviteRoleOption<'member' | 'admin'>[] = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin, can invite and manage' },
];

/**
 * A SHARED space's roles (Spaces F7, 12 October 2026; backend B2). Viewer
 * first, because reading is the safer thing to give someone by default.
 */
export const SHARED_INVITE_ROLES: readonly InviteRoleOption<InvitableContentRole>[] = [
  { value: 'viewer', label: 'Viewer, can read everything in the space' },
  { value: 'editor', label: 'Contributor, can also add and continue chats' },
];
