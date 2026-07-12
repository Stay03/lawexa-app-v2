'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  useInviteSpaceMember,
  useLeaveSpace,
  useRemoveSpaceMember,
  useSpaceMembers,
  useTransferSpaceOwnership,
  useUpdateSpaceMemberRole,
} from '@/lib/hooks/useCollab';
import { extractApiError } from '@/lib/utils/api-error';
import type { InviteMemberPayload, Member, Space } from '@/types/collab';

import { InviteMemberDialog } from './InviteMemberDialog';
import { MemberListItem } from './MemberListItem';

interface SpaceMembersSheetProps {
  space: Space;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Roster, role management, ownership transfer and leave for a space. */
export function SpaceMembersSheet({
  space,
  open,
  onOpenChange,
}: SpaceMembersSheetProps) {
  const router = useRouter();
  const myUuid = useCurrentUserUuid();
  const membersQuery = useSpaceMembers(space.uuid, {}, { enabled: open });

  const invite = useInviteSpaceMember(space.uuid);
  const updateRole = useUpdateSpaceMemberRole(space.uuid);
  const removeMember = useRemoveSpaceMember(space.uuid);
  const transfer = useTransferSpaceOwnership(space.uuid);
  const leave = useLeaveSpace(space.uuid);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);

  const members = membersQuery.data?.data ?? [];
  const myMember = members.find((m) => m.user.uuid === myUuid);
  const isOwner = myMember?.role === 'owner';
  const canManage = isOwner || myMember?.role === 'admin';

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

  const handleTransfer = async () => {
    if (!transferTarget) return;
    try {
      await transfer.mutateAsync({ user_uuid: transferTarget.user.uuid });
      toast.success(`${transferTarget.user.name} is now the owner`);
      setTransferTarget(null);
    } catch (error) {
      toast.error('Could not transfer ownership', {
        description: extractApiError(error).message,
      });
    }
  };

  const handleLeave = async () => {
    try {
      await leave.mutateAsync();
      setLeaveOpen(false);
      onOpenChange(false);
      router.push('/spaces');
    } catch (error) {
      toast.error('Could not leave space', {
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
            {space.active_members_count} in {space.name}
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
                  onTransferOwnership={
                    isOwner ? (m) => setTransferTarget(m) : undefined
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
            Leave space
          </Button>
        </div>
      </SheetContent>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title={`Invite to ${space.name}`}
        onInvite={handleInvite}
      />

      <AlertDialog
        open={transferTarget !== null}
        onOpenChange={(next) => {
          if (!next) setTransferTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Transfer ownership to {transferTarget?.user.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They become the space owner and you&apos;ll be changed to an admin.
              This can&apos;t be undone without a new transfer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transfer.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleTransfer();
              }}
              disabled={transfer.isPending}
            >
              {transfer.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {space.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll lose access to this space and its channels. Owners must
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
