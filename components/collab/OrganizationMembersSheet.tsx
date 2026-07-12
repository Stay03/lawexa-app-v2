'use client';

import { useState } from 'react';
import { Loader2, LogOut, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCurrentUserUuid,
  useInviteOrgMember,
  useLeaveMyOrganization,
  useOrganizationMembers,
  useRemoveOrgMember,
  useUpdateOrgMemberRole,
} from '@/lib/hooks/useCollab';
import { extractApiError } from '@/lib/utils/api-error';
import type { InviteMemberPayload, Member, Organization } from '@/types/collab';

import { InviteMemberDialog } from './InviteMemberDialog';
import { MemberListItem } from './MemberListItem';

interface OrganizationMembersSheetProps {
  organization: Organization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Roster, role management and leave for an organization. */
export function OrganizationMembersSheet({
  organization,
  open,
  onOpenChange,
}: OrganizationMembersSheetProps) {
  const myUuid = useCurrentUserUuid();
  const membersQuery = useOrganizationMembers(
    organization.uuid,
    {},
    { enabled: open }
  );

  const invite = useInviteOrgMember(organization.uuid);
  const updateRole = useUpdateOrgMemberRole(organization.uuid);
  const removeMember = useRemoveOrgMember(organization.uuid);
  const leave = useLeaveMyOrganization();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const members =
    membersQuery.data?.data ?? organization.members ?? [];
  const myMember = members.find((m) => m.user.uuid === myUuid);
  const canManage = myMember?.role === 'owner' || myMember?.role === 'admin';

  const handleInvite = async (payload: InviteMemberPayload) => {
    await invite.mutateAsync(payload);
    toast.success('Invitation sent');
  };

  const handleRole = async (member: Member, role: 'admin' | 'member') => {
    try {
      await updateRole.mutateAsync({ userUuid: member.user.uuid, role });
      toast.success(`${member.user.name} is now ${role}`);
    } catch (error) {
      toast.error('Could not change role', {
        description: extractApiError(error).message,
      });
    }
  };

  const handleRemove = async (member: Member) => {
    try {
      await removeMember.mutateAsync(member.user.uuid);
      toast.success(`Removed ${member.user.name}`);
    } catch (error) {
      toast.error('Could not remove member', {
        description: extractApiError(error).message,
      });
    }
  };

  const handleLeave = async () => {
    try {
      await leave.mutateAsync();
      setLeaveOpen(false);
      onOpenChange(false);
    } catch (error) {
      toast.error('Could not leave organization', {
        description: extractApiError(error).message,
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-sm"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Members</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {organization.active_members_count ?? members.length} in{' '}
            {organization.name}
          </p>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {canManage && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              Invite people
            </Button>
          )}

          <div className="divide-y">
            {membersQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))
            ) : (
              members.map((member) => (
                <MemberListItem
                  key={member.id}
                  member={member}
                  isSelf={member.user.uuid === myUuid}
                  onPromote={
                    canManage ? (m) => handleRole(m, 'admin') : undefined
                  }
                  onDemote={
                    canManage ? (m) => handleRole(m, 'member') : undefined
                  }
                  onRemove={canManage ? handleRemove : undefined}
                />
              ))
            )}
          </div>
        </div>

        <div className="border-t p-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => setLeaveOpen(true)}
          >
            <LogOut className="h-4 w-4" />
            Leave organization
          </Button>
        </div>
      </SheetContent>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title={`Invite to ${organization.name}`}
        onInvite={handleInvite}
      />

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {organization.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll lose access to this organization. An owner must
              transfer ownership before leaving while other members remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leave.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleLeave();
              }}
              disabled={leave.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leave.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
