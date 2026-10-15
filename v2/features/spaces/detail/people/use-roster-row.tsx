'use client';

import type { ReactNode } from 'react';

import type { Member, Space } from '@/types/collab';
import { RosterRow } from '@/v2/features/collab/membership/RosterRow';
import { contentRoleChangePayload } from '../../model';
import { useRemoveSpaceMember, useUpdateSpaceMemberRole } from '../../mutations';

/**
 * One roster row for a space, with the actions the viewer may take on it: the
 * row the members sheet draws, and the one the People tab draws (Stay, 15
 * October 2026: "inside the space, there should be a people tab"). Both read
 * it from here, so a member can never be promotable in one and not the other.
 *
 * `onTransferOwnership` stays with the caller: the sheet holds the transfer
 * confirmation and its error line, so only the sheet passes it.
 */
export function useSpaceRosterRow({
  space,
  viewerUuid,
  canManage,
  shared,
  onTransferOwnership,
}: {
  space: Pick<Space, 'uuid'>;
  viewerUuid: string | null;
  canManage: boolean;
  /** A shared space speaks in content roles (Owner, Contributor, Viewer). */
  shared: boolean;
  onTransferOwnership?: (target: Member) => void;
}): (member: Member, underInvited?: boolean) => ReactNode {
  const updateRole = useUpdateSpaceMemberRole(space.uuid);
  const removeMember = useRemoveSpaceMember(space.uuid);

  // `underInvited`: the row sits under the "Invited" heading, so it drops the
  // Pending chip that would repeat it.
  function rosterRow(member: Member, underInvited = false) {
    return (
      <RosterRow
        key={member.user.uuid}
        member={member}
        showPending={!underInvited}
        isSelf={member.user.uuid === viewerUuid}
        contentRoles={shared}
        onPromote={
          canManage && !shared
            ? (target) =>
                updateRole.mutate({
                  userUuid: target.user.uuid,
                  payload: { role: 'admin' },
                })
            : undefined
        }
        onDemote={
          canManage && !shared
            ? (target) =>
                updateRole.mutate({
                  userUuid: target.user.uuid,
                  payload: { role: 'member' },
                })
            : undefined
        }
        onSetContentRole={
          canManage && shared
            ? (target, next) =>
                updateRole.mutate({
                  userUuid: target.user.uuid,
                  payload: contentRoleChangePayload(next),
                })
            : undefined
        }
        onTransferOwnership={onTransferOwnership}
        onRemove={
          canManage ? (target) => removeMember.mutate(target.user.uuid) : undefined
        }
      />
    );
  }
  return rosterRow;
}
