import type { InvitableContentRole } from '@/v2/features/collab/membership/content-role';

/**
 * The role a "Let them in" on a shared space's join request starts on.
 *
 * CONTRIBUTOR BY DEFAULT (Stay, 16 October 2026, 11:03Z). The server says what
 * approving with no role would give (`approves_as`): the role the person's
 * invite link set, else Contributor. A Discover ask and a link that set no role
 * both read "editor"; only the Owner's own Viewer link reads "viewer", because
 * only the Owner makes links in a shared space (backend, 16 October 2026). So
 * the card starts on Viewer for that one case and on Contributor for every
 * other, including a row from a server that does not send the field yet.
 *
 * The card always sends the role it shows (`content_role`), so what the Owner
 * sees is what they give.
 */
export function joinRequestStartRole(approvesAs: unknown): InvitableContentRole {
  return approvesAs === 'viewer' ? 'viewer' : 'editor';
}
