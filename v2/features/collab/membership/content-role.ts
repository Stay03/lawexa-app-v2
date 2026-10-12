import type { ContentRole, Member } from '@/types/collab';

/**
 * content-role — the vocabulary of the CONTENT roles (Owner, Editor, Viewer)
 * that govern a SHARED space's members (Spaces F7, 12 October 2026; backend
 * B2). The old `MemberRole` (owner, admin, member) keeps governing team spaces
 * and their channels; on a shared space the backend writes both columns, and
 * every member surface reads the content one. Pure, so the roster row, the
 * members sheet and the spaces model share one answer.
 */

/** The two roles an Owner can give: Owner itself only passes by transfer. */
export type InvitableContentRole = Exclude<ContentRole, 'owner'>;

export const CONTENT_ROLE_LABELS: Readonly<Record<ContentRole, string>> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

/**
 * A member's content role. Read off the row from B2 (`content_role`); before
 * that deploy it is derived the way the backend derives it for old rows
 * (design 2.1): the old owner is the Owner, an admin or member an Editor. A
 * Viewer only exists once B2 writes one, so nobody is ever shown as a Viewer
 * by guesswork.
 */
export function contentRoleOf(member: Pick<Member, 'role' | 'content_role'>): ContentRole {
  if (member.content_role) return member.content_role;
  return member.role === 'owner' ? 'owner' : 'editor';
}

/** The word a roster shows for a member's content role: the server's label
 *  when it sent one, else ours. */
export function contentRoleLabelOf(
  member: Pick<Member, 'role' | 'content_role' | 'content_role_label'>,
): string {
  return member.content_role_label?.trim() || CONTENT_ROLE_LABELS[contentRoleOf(member)];
}

/** Narrow a role string to one an Owner may give on a shared space. */
export function isInvitableContentRole(value: string): value is InvitableContentRole {
  return value === 'editor' || value === 'viewer';
}
