'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, LogOut, UserPlus } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { InviteMemberPayload, Organization } from '@/types/collab';
import { InvitePeopleDialog } from '@/v2/features/spaces/membership/InvitePeopleDialog';
import { MembersSheetFrame } from '@/v2/features/spaces/membership/MembersSheetFrame';
import {
  RosterErrorState,
  RosterRow,
  RosterSkeleton,
} from '@/v2/features/spaces/membership/RosterRow';
import { memberCountLabel } from '@/v2/features/spaces/model';
import {
  useInviteOrganizationMember,
  useLeaveMyOrganization,
  useRemoveOrganizationMember,
  useUpdateOrganizationMemberRole,
} from './mutations';
import { organizationsQueries } from './queries';

/**
 * OrganizationMembersSheet — roster, role management, invites and leave for
 * the caller's organization (study A8: KEEP, on the SAME shared roster row and
 * sheet frame the space sheet uses, so the two are one component family and
 * not two designs).
 *
 * NO OWNERSHIP TRANSFER HERE, and that is a contract fact rather than an
 * omission: organizations have no transfer route (`onTransferOwnership` is
 * simply not passed, so the row never offers it). Leaving is
 * `POST /my-organization/leave` — no uuid, because a person has at most one
 * organization.
 *
 * The roster query mounts only while the sheet is open; the screen behind it
 * keeps its own copy warm, so opening this usually paints rows rather than a
 * skeleton. Rows key on `member.user.uuid` (§F.4). Phase-5 W4, 2026-08-04.
 */
export function OrganizationMembersSheet({
  organization,
  viewerId,
  viewerUuid,
  open,
  onOpenChange,
}: {
  organization: Organization;
  viewerId: number | null;
  viewerUuid: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const membersQuery = useQuery({
    ...organizationsQueries.members(organization.uuid, { viewerId }),
    enabled: open,
  });

  const invite = useInviteOrganizationMember(organization.uuid);
  const updateRole = useUpdateOrganizationMemberRole(organization.uuid);
  const removeMember = useRemoveOrganizationMember(organization.uuid);
  const leave = useLeaveMyOrganization();

  // The embedded roster on the organization payload is the first-frame
  // fallback; the query is the source once it lands.
  const members = membersQuery.data?.data ?? organization.members ?? [];
  const myRole = members.find((member) => member.user.uuid === viewerUuid)?.role ?? null;
  const canManage = myRole === 'owner' || myRole === 'admin';

  const handleInvite = (payload: InviteMemberPayload) =>
    new Promise<void>((resolve, reject) => {
      invite.mutate(payload, {
        onSuccess: () => resolve(),
        onError: (error) => reject(error),
      });
    });

  const handleLeave = () => {
    setLeaveError(null);
    leave.mutate(undefined, {
      onSuccess: () => {
        setLeaveOpen(false);
        onOpenChange(false);
      },
      onError: (error) => setLeaveError(extractApiError(error).message),
    });
  };

  return (
    <>
      <MembersSheetFrame
        open={open}
        onOpenChange={onOpenChange}
        title="Members"
        subtitle={`${memberCountLabel(
          organization.active_members_count ?? members.length,
        )} in ${organization.name}`}
        footer={
          <Button
            variant="ghost"
            className="v2-interactive w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setLeaveError(null);
              setLeaveOpen(true);
            }}
          >
            <LogOut aria-hidden className="size-4" />
            Leave organization
          </Button>
        }
      >
        {canManage && (
          <Button
            variant="outline"
            className="v2-interactive w-full"
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus aria-hidden className="size-4" />
            Invite people
          </Button>
        )}

        <div className="divide-y divide-border/60">
          {membersQuery.isPending && members.length === 0 ? (
            <RosterSkeleton />
          ) : membersQuery.isError && members.length === 0 ? (
            <RosterErrorState onRetry={() => void membersQuery.refetch()} />
          ) : (
            members.map((member) => (
              <RosterRow
                key={member.user.uuid}
                member={member}
                isSelf={member.user.uuid === viewerUuid}
                onPromote={
                  canManage
                    ? (target) =>
                        updateRole.mutate({ userUuid: target.user.uuid, role: 'admin' })
                    : undefined
                }
                onDemote={
                  canManage
                    ? (target) =>
                        updateRole.mutate({ userUuid: target.user.uuid, role: 'member' })
                    : undefined
                }
                onRemove={
                  canManage
                    ? (target) => removeMember.mutate(target.user.uuid)
                    : undefined
                }
              />
            ))
          )}
        </div>
      </MembersSheetFrame>

      <InvitePeopleDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title={`Invite to ${organization.name}`}
        description="They get an invitation they can accept from their own Invitations page."
        onInvite={handleInvite}
      />

      <AlertDialog
        open={leaveOpen}
        onOpenChange={(next) => {
          setLeaveOpen(next);
          if (!next) setLeaveError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {organization.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You lose your place in this organization. Spaces it owns stay where
              they are — you keep any space membership you hold in your own right.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {leaveError && (
            <p role="alert" className="text-sm text-destructive">
              {leaveError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leave.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleLeave();
              }}
              disabled={leave.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leave.isPending && (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              )}
              Leave organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
