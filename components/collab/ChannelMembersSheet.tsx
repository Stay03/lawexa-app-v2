'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Loader2, LogOut, UserPlus } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useChannelMembers,
  useCurrentUserUuid,
  useInviteChannelMember,
  useLeaveChannel,
  useRemoveChannelMember,
  useSetChannelNotifyLevel,
  useSpaceMembers,
  useUpdateChannelMemberRole,
} from '@/lib/hooks/useCollab';
import { extractApiError } from '@/lib/utils/api-error';
import type { Channel, InviteMemberPayload, Member, NotifyLevel } from '@/types/collab';

import { InviteMemberDialog } from './InviteMemberDialog';
import { MemberListItem } from './MemberListItem';

const NOTIFY_OPTIONS: { value: NotifyLevel; label: string }[] = [
  { value: 'all', label: 'All messages' },
  { value: 'mentions_only', label: 'Mentions only' },
  { value: 'muted', label: 'Muted' },
];

interface ChannelMembersSheetProps {
  channel: Channel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Roster, role management, notification level and leave for a channel. */
export function ChannelMembersSheet({
  channel,
  open,
  onOpenChange,
}: ChannelMembersSheetProps) {
  const router = useRouter();
  const myUuid = useCurrentUserUuid();
  const membersQuery = useChannelMembers(channel.uuid, {}, { enabled: open });

  const invite = useInviteChannelMember(channel.uuid);
  const updateRole = useUpdateChannelMemberRole(channel.uuid);
  const removeMember = useRemoveChannelMember(channel.uuid);
  const setNotify = useSetChannelNotifyLevel(channel.uuid);
  const leave = useLeaveChannel(channel.uuid);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const members = membersQuery.data?.data ?? [];
  const myMember = members.find((m) => m.user.uuid === myUuid);
  const canManage = myMember?.role === 'owner' || myMember?.role === 'admin';

  // Space members who aren't in this channel yet — added directly by uuid.
  const spaceMembersQuery = useSpaceMembers(
    channel.space.uuid,
    {},
    { enabled: open && inviteOpen }
  );
  const inChannel = new Set(members.map((m) => m.user.uuid));
  const candidates = (spaceMembersQuery.data?.data ?? [])
    .filter((m) => m.is_active && !inChannel.has(m.user.uuid))
    .map((m) => ({ user: m.user }));
  const notifyLevel: NotifyLevel =
    channel.my_notify_level ?? myMember?.notify_level ?? 'all';

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

  const handleNotify = async (value: NotifyLevel) => {
    try {
      await setNotify.mutateAsync({ notify_level: value });
    } catch (error) {
      toast.error('Could not update notifications', {
        description: extractApiError(error).message,
      });
    }
  };

  const handleLeave = async () => {
    try {
      await leave.mutateAsync();
      setLeaveOpen(false);
      onOpenChange(false);
      router.push(`/spaces/${channel.space.uuid}`);
    } catch (error) {
      toast.error('Could not leave channel', {
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
            {channel.active_members_count} in #{channel.name}
          </p>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Bell className="h-3.5 w-3.5" />
              Notifications
            </span>
            <Select
              value={notifyLevel}
              onValueChange={(value) => handleNotify(value as NotifyLevel)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            Leave channel
          </Button>
        </div>
      </SheetContent>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title={`Invite to #${channel.name}`}
        description="Add someone from this space, or invite a new person by email."
        onInvite={handleInvite}
        candidates={candidates}
        candidatesLoading={spaceMembersQuery.isLoading}
      />

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave #{channel.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll stop receiving messages from this channel. You can
              rejoin later if it&apos;s public or you&apos;re invited again.
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
