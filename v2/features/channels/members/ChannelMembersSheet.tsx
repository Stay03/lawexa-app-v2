'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { Channel, InviteMemberPayload, Member } from '@/types/collab';
import { spacesQueries } from '@/v2/features/spaces/queries';
import {
  useInviteChannelMember,
  useRemoveChannelMember,
  useUpdateChannelMemberRole,
} from '../membership-mutations';
import { canManageChannel } from '../model';
import { channelsQueries } from '../queries';
import { InviteMemberDialog } from './InviteMemberDialog';
import { MemberRow } from './MemberRow';

/**
 * ChannelMembersSheet — roster, role management and invites for a channel
 * (v2 port of v1's sheet; study A3 KEEP). The notify-level control lives in
 * the channel header's menu (one home, not two) and leave lives beside it —
 * this sheet is about the PEOPLE. Rows key on `member.user.uuid` (the member
 * surface is uuid-only — digest §F.4). Queries mount only while the sheet is
 * open, and the invite picker's space roster only while IT is open (v1's
 * lazy pattern, kept). Phase-5 W2, 2026-08-04.
 *
 * Role/remove failures fall to the global mutation error channel; invite
 * failures surface inline in the dialog (its contract).
 */
export function ChannelMembersSheet({
  channel,
  viewerId,
  viewerUuid,
  open,
  onOpenChange,
}: {
  channel: Channel;
  viewerId: number | null;
  viewerUuid: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);

  const membersQuery = useQuery({
    ...channelsQueries.members(channel.uuid, { viewerId }),
    enabled: open,
  });
  const spaceMembersQuery = useQuery({
    ...spacesQueries.members(channel.space.uuid, { viewerId }),
    enabled: open && inviteOpen,
  });

  const invite = useInviteChannelMember(channel.uuid);
  const updateRole = useUpdateChannelMemberRole(channel.uuid);
  const removeMember = useRemoveChannelMember(channel.uuid);

  const members = useMemo(
    () => membersQuery.data?.data ?? [],
    [membersQuery.data],
  );
  const canManage = canManageChannel(channel);

  // Space members not yet in this channel — addable directly by uuid
  // (invitees must be active space members, digest §F.15).
  const candidates = useMemo(() => {
    const inChannel = new Set(members.map((member) => member.user.uuid));
    return (spaceMembersQuery.data?.data ?? [])
      .filter((member) => member.is_active && !inChannel.has(member.user.uuid))
      .map((member) => ({ user: member.user }));
  }, [members, spaceMembersQuery.data]);

  const handleInvite = (payload: InviteMemberPayload) =>
    new Promise<void>((resolve, reject) => {
      invite.mutate(payload, {
        onSuccess: () => resolve(),
        onError: (error) => reject(error),
      });
    });

  const handleRole = (member: Member, role: 'admin' | 'member') => {
    updateRole.mutate({ userUuid: member.user.uuid, role });
  };

  const handleRemove = (member: Member) => {
    removeMember.mutate(member.user.uuid);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b">
          <SheetTitle>Members</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {channel.active_members_count} in {channel.name}
          </p>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {canManage && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus aria-hidden className="size-4" />
              Invite people
            </Button>
          )}

          <div className="divide-y">
            {membersQuery.isPending ? (
              <MembersRosterSkeleton />
            ) : membersQuery.isError ? (
              <div className="py-6 text-center text-sm">
                <p className="text-muted-foreground">
                  Couldn&rsquo;t load the member list.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void membersQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : (
              members.map((member) => (
                <MemberRow
                  key={member.user.uuid}
                  member={member}
                  isSelf={member.user.uuid === viewerUuid}
                  onPromote={canManage ? (m) => handleRole(m, 'admin') : undefined}
                  onDemote={canManage ? (m) => handleRole(m, 'member') : undefined}
                  onRemove={canManage ? handleRemove : undefined}
                />
              ))
            )}
          </div>
        </div>
      </SheetContent>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title={`Invite to ${channel.name}`}
        description="Add someone from this space, or invite a new person by email."
        onInvite={handleInvite}
        candidates={candidates}
        candidatesLoading={spaceMembersQuery.isPending}
      />
    </Sheet>
  );
}

function MembersRosterSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="flex items-center gap-3 py-2"
          style={{ opacity: Math.max(0.3, 1 - index * 0.2) }}
        >
          <Skeleton className="size-6 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2 rounded" />
            <Skeleton className="h-3 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
