import type { InvitableContentRole } from './content-role';

/**
 * The role lists the invite dialog offers (`InvitePeopleDialog`), kept beside
 * the dialog because two features draw it: spaces and organizations. Plain
 * words and no dashes in the labels, the owner's rule for UI copy.
 *
 * ── A NAME, AND WHAT IT MEANS (design round 1, 12 October 2026) ────────────
 * The meaning used to ride in the label after a comma ("Viewer, can read
 * everything in the space"), which the closed select then had to print whole
 * and cut on a 360px phone. The name and the meaning are separate fields now:
 * the open list shows both on two lines, the closed select only the name
 * (`RoleSelect`).
 */

/** One choice in the invite dialog's role select. */
export interface InviteRoleOption<Role extends string = string> {
  value: Role;
  /** The role's name, the only thing the closed select shows. */
  label: string;
  /** What the role may do, under the name in the open list. */
  description?: string;
}

/** A team space's and an organization's roles, as they always were. */
export const TEAM_INVITE_ROLES: readonly InviteRoleOption<'member' | 'admin'>[] = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin', description: 'Can invite people and manage them' },
];

/**
 * A SHARED space's roles (Spaces F7, 12 October 2026; backend B2). Viewer
 * first, because reading is the safer thing to give someone by default.
 *
 * A Contributor may continue the space's conversations since backend B4
 * (Spaces F4), so the meaning says it. The invitation card says the same in
 * its own sentence (`invitations/row-model.ts`, CONTRIBUTOR_MEANING), and
 * the two change together.
 */
export const SHARED_INVITE_ROLES: readonly InviteRoleOption<InvitableContentRole>[] = [
  { value: 'viewer', label: 'Viewer', description: 'Can read everything in the space' },
  {
    value: 'editor',
    label: 'Contributor',
    description: 'Can also add to the space and continue its conversations',
  },
];
