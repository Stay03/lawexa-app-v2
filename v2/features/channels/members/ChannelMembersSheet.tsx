'use client';

import { useMemo } from 'react';
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
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import {
  useInviteChannelMember,
  useRemoveChannelMember,
  useUpdateChannelMemberRole,
} from '../membership-mutations';
import { canManageChannel } from '../model';
import { channelsQueries } from '../queries';
import { channelDisplayName } from '../thread-model';
import type { ChannelPresence } from '../room';
import { InviteMemberDialog } from './InviteMemberDialog';
import { MemberRow } from './MemberRow';
import { PresentMemberRow } from './PresentMemberRow';
import { groupRoster, type RosterRow } from './roster-groups';

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
 *
 * ── IN A THREAD IT IS READ-ONLY, AND `canManageChannel` DOES NOT SAY SO ────
 * A thread's roster is its FOLLOWER list, and the server denies `invite` and
 * `manageMembers` on a thread outright — no role passes, not even the platform
 * admin's. `canManageChannel` cannot express that: the person who started the
 * thread is its Owner member, so it answers TRUE for them and would hand them an
 * Invite button and three role menus that can only 403. The thread test is
 * therefore explicit and sits in front of the role test, not inside it.
 */
export function ChannelMembersSheet({
  channel,
  viewerId,
  viewerUuid,
  presence,
  open,
  onOpenChange,
}: {
  channel: Channel;
  viewerId: number | null;
  viewerUuid: string | null;
  /** Who is in the room right now, handed down from the screen that joined it.
   *  `null` for a reader with no room at all. The sheet never joins its own:
   *  the room's lifecycle belongs to the screen, and a second join of the same
   *  presence channel from one client is at best redundant. Sharing the screen's
   *  object also means this list and the faces in the header cannot disagree. */
  presence: ChannelPresence | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const canManage = !channel.is_thread && canManageChannel(channel);
  const displayName = channelDisplayName(channel);
  /** Its own param, not a value of the screen's `?panel=`: invite opens ON TOP
   *  of this sheet, and one param holds one value. The URL reads
   *  `?panel=members&invite=1`, so Back closes invite, then the roster. Gated on
   *  the same `canManage` the button is. */
  const invitePanel = useUrlOverlay('invite', { canOpen: canManage });

  const membersQuery = useQuery({
    ...channelsQueries.members(channel.uuid, { viewerId }),
    enabled: open,
  });
  const spaceMembersQuery = useQuery({
    ...spacesQueries.members(channel.space.uuid, { viewerId }),
    enabled: open && invitePanel.open,
  });

  const invite = useInviteChannelMember(channel.uuid);
  const updateRole = useUpdateChannelMemberRole(channel.uuid);
  const removeMember = useRemoveChannelMember(channel.uuid);

  const members = useMemo(
    () => membersQuery.data?.data ?? [],
    [membersQuery.data],
  );

  /** Three groups, or `null` when the room has not answered and grouping would
   *  be a claim rather than a fact. See {@link groupRoster} for why presence
   *  leads and the fetched page follows. */
  const groups = useMemo(
    () =>
      groupRoster({
        members,
        presence,
        totalMembers: channel.active_members_count,
      }),
    [members, presence, channel.active_members_count],
  );

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
      {/* Variant-matched width, or these are dead classes — see `SpaceDrawer`.
          `sm:max-w-sm` happened to match what the primitive already sets, but
          `w-full` did not, so on a phone this drew at three quarters. */}
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-sm"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Members</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {channel.active_members_count} in {displayName}
          </p>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {canManage && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => invitePanel.show()}
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
              (() => {
                const row = (entry: RosterRow) =>
                  entry.member ? (
                    <MemberRow
                      key={entry.uuid}
                      member={entry.member}
                      isSelf={entry.uuid === viewerUuid}
                      onPromote={canManage ? (m) => handleRole(m, 'admin') : undefined}
                      onDemote={canManage ? (m) => handleRole(m, 'member') : undefined}
                      onRemove={canManage ? handleRemove : undefined}
                    />
                  ) : (
                    // Present, but not on the page of members we fetched, or
                    // (in a thread) not on the roster at all. Shown with what
                    // presence knows and nothing invented.
                    <PresentMemberRow
                      key={entry.uuid}
                      row={entry}
                      isSelf={entry.uuid === viewerUuid}
                    />
                  );

                // The room has not answered, or there is no room: the flat list
                // this sheet has always shown.
                if (!groups) {
                  return members.map((member) => (
                    <MemberRow
                      key={member.user.uuid}
                      member={member}
                      isSelf={member.user.uuid === viewerUuid}
                      onPromote={canManage ? (m) => handleRole(m, 'admin') : undefined}
                      onDemote={canManage ? (m) => handleRole(m, 'member') : undefined}
                      onRemove={canManage ? handleRemove : undefined}
                    />
                  ));
                }

                return (
                  <>
                    {groups.hereNow.length > 0 && (
                      <RosterGroup label={`Here now, ${groups.hereNow.length}`}>
                        {groups.hereNow.map(row)}
                      </RosterGroup>
                    )}
                    {groups.hereNotLooking.length > 0 && (
                      <RosterGroup
                        label={`Here, not looking, ${groups.hereNotLooking.length}`}
                      >
                        {groups.hereNotLooking.map(row)}
                      </RosterGroup>
                    )}
                    {groups.everyoneElse.length > 0 && (
                      <RosterGroup label="Everyone else">
                        {groups.everyoneElse.map(row)}
                      </RosterGroup>
                    )}
                    {/* The roster fetches one page. Saying nothing here would
                        let the list read as the whole channel when it is not. */}
                    {groups.notFetched > 0 && (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        and {groups.notFetched} more{' '}
                        {groups.notFetched === 1 ? 'member' : 'members'}
                      </p>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      </SheetContent>

      {/* Keyed like every other form dialog: Back closes this by flipping the
          `open` PROP, which fires no `onOpenChange`, so a close-path reset would
          never run and the last address, error and throttle rest would survive
          into the next opening. The remount is what clears them. */}
      <InviteMemberDialog
        key={invitePanel.keyFor()}
        open={invitePanel.open}
        onOpenChange={invitePanel.setOpen}
        title={`Invite to ${displayName}`}
        description="Add someone from this space, or invite a new person by email."
        onInvite={handleInvite}
        candidates={candidates}
        candidatesLoading={spaceMembersQuery.isPending}
        linkScope={{
          spaceUuid: channel.space.uuid,
          channelUuid: channel.uuid,
          placeName: `#${displayName}`,
        }}
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

/**
 * One labelled band of the roster. The label carries its own count rather than
 * leaving the reader to tally faces, except on the last group, whose size is a
 * page of members and not a fact about the channel.
 */
function RosterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-2 first:pt-0">
      <h3 className="pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </h3>
      <div className="divide-y">{children}</div>
    </section>
  );
}
