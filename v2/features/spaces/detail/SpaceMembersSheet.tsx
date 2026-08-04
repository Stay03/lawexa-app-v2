'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import type { InviteMemberPayload, Member, Space } from '@/types/collab';
import { InvitePeopleDialog } from '../membership/InvitePeopleDialog';
import { MembersSheetFrame } from '../membership/MembersSheetFrame';
import { RosterErrorState, RosterRow, RosterSkeleton } from '../membership/RosterRow';
import {
  isOwnerMustTransferError,
  memberCountLabel,
  roleInRoster,
} from '../model';
import {
  useInviteSpaceMember,
  useLeaveSpace,
  useRemoveSpaceMember,
  useTransferSpaceOwnership,
  useUpdateSpaceMemberRole,
} from '../mutations';
import { spacesQueries } from '../queries';

/**
 * SpaceMembersSheet — roster, role management, ownership transfer, invites and
 * leave for one space (study A2: KEEP — "dense, correct, complete" — ported
 * onto v2 primitives and the shared roster row).
 *
 * ── THE OWNER-LEAVE REFUSAL IS A DESIGNED STATE, NOT AN ERROR ──────────────
 * `POST /spaces/{uuid}/leave` answers **400** when the caller owns the space
 * and other members remain. That is not a failure — it is the product telling
 * the owner to hand the space over first — so it never reaches the global error
 * toast (`silentError`) and never paints red. The confirm dialog stays open and
 * SWAPS into an explanation with the server's own sentence and the way forward
 * (the roster's own "Transfer ownership" action, one gesture away behind the
 * sheet). Keyed on the STATUS, never on the copy (§F.5's anti-oracle rule).
 *
 * ── WHAT TRANSFER ACTUALLY DOES, SAID OUT LOUD ─────────────────────────────
 * The old owner is DEMOTED TO ADMIN server-side (digest §C). The confirmation
 * says so, because "transfer ownership" alone reads as "and then I leave",
 * which is not what happens.
 *
 * THE ROSTER IS ALREADY WARM WHEN THIS OPENS. `SpaceScreen` mounts the same
 * roster key alongside the space (it needs the caller's role from it), so this
 * sheet's own `enabled: open` query resolves to a populated cache entry and
 * paints rows rather than a skeleton — v1's lazy-fetch-on-open is deliberately
 * NOT the shape here. The gate is kept anyway so the sheet is self-sufficient
 * if it is ever mounted somewhere the screen has not already asked.
 *
 * Rows key on `member.user.uuid` — the member surface is uuid-only (§F.4).
 * Phase-5 W4, 2026-08-04.
 */
export function SpaceMembersSheet({
  space,
  viewerId,
  viewerUuid,
  open,
  onOpenChange,
}: {
  space: Space;
  viewerId: number | null;
  viewerUuid: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  /** The server's sentence when leaving was refused because the caller owns
   *  the space — the designed refusal, not an error. */
  const [mustTransfer, setMustTransfer] = useState<string | null>(null);

  const membersQuery = useQuery({
    ...spacesQueries.members(space.uuid, { viewerId }),
    enabled: open,
  });

  const invite = useInviteSpaceMember(space.uuid);
  const updateRole = useUpdateSpaceMemberRole(space.uuid);
  const removeMember = useRemoveSpaceMember(space.uuid);
  const transfer = useTransferSpaceOwnership(space.uuid);
  const leave = useLeaveSpace(space.uuid);

  const members = membersQuery.data?.data ?? [];
  // The roster is the honest source while the sheet is open; the row's own
  // `my_role` stamp is the fallback for the first frame before it lands.
  const myRole = roleInRoster(members, viewerUuid) ?? space.my_role ?? null;
  const isOwner = myRole === 'owner';
  const canManage = isOwner || myRole === 'admin';

  const handleInvite = (payload: InviteMemberPayload) =>
    new Promise<void>((resolve, reject) => {
      invite.mutate(payload, {
        onSuccess: () => resolve(),
        onError: (error) => reject(error),
      });
    });

  const handleTransfer = () => {
    if (!transferTarget) return;
    setTransferError(null);
    transfer.mutate(
      { user_uuid: transferTarget.user.uuid },
      {
        onSuccess: () => setTransferTarget(null),
        onError: (error) => setTransferError(extractApiError(error).message),
      },
    );
  };

  const handleLeave = () => {
    setMustTransfer(null);
    leave.mutate(undefined, {
      onSuccess: () => {
        setLeaveOpen(false);
        onOpenChange(false);
        router.push('/spaces');
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        if (isOwnerMustTransferError(apiError.status)) {
          setMustTransfer(
            apiError.message.trim() ||
              'Transfer ownership to another member before you leave.',
          );
          return;
        }
        // Anything else is a genuine failure: close the confirmation and let
        // the ONE global mutation-error channel say so.
        setLeaveOpen(false);
      },
    });
  };

  return (
    <>
      <MembersSheetFrame
        open={open}
        onOpenChange={onOpenChange}
        title="Members"
        subtitle={`${memberCountLabel(space.active_members_count)} in ${space.name}`}
        footer={
          <Button
            variant="ghost"
            className="v2-interactive w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setMustTransfer(null);
              setLeaveOpen(true);
            }}
          >
            <LogOut aria-hidden className="size-4" />
            Leave space
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
          {membersQuery.isPending ? (
            <RosterSkeleton />
          ) : membersQuery.isError ? (
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
                        updateRole.mutate({
                          userUuid: target.user.uuid,
                          role: 'admin',
                        })
                    : undefined
                }
                onDemote={
                  canManage
                    ? (target) =>
                        updateRole.mutate({
                          userUuid: target.user.uuid,
                          role: 'member',
                        })
                    : undefined
                }
                onTransferOwnership={
                  isOwner
                    ? (target) => {
                        setTransferError(null);
                        setTransferTarget(target);
                      }
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
        title={`Invite to ${space.name}`}
        description="They get an invitation they can accept from their own Invitations page."
        onInvite={handleInvite}
      />

      <AlertDialog
        open={transferTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setTransferTarget(null);
            setTransferError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Make {transferTarget?.user.name} the owner?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They take over {space.name}, and you become an admin. Only the new
              owner can hand it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {transferError && (
            <p role="alert" className="text-sm text-destructive">
              {transferError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transfer.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleTransfer();
              }}
              disabled={transfer.isPending}
            >
              {transfer.isPending && (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              )}
              Transfer ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={leaveOpen}
        onOpenChange={(next) => {
          setLeaveOpen(next);
          if (!next) setMustTransfer(null);
        }}
      >
        <AlertDialogContent>
          {mustTransfer ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Transfer ownership first</AlertDialogTitle>
                <AlertDialogDescription>
                  {mustTransfer} Open a member&rsquo;s menu in this list and choose
                  “Transfer ownership”, then you can leave.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setLeaveOpen(false)}>
                  Got it
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave {space.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  You lose access to this space and every channel in it. Someone
                  can invite you back.
                </AlertDialogDescription>
              </AlertDialogHeader>
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
                  Leave space
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
