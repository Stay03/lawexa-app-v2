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
import { InvitePeopleDialog } from '@/v2/features/collab/membership/InvitePeopleDialog';
import { MembersSheetFrame } from '@/v2/features/collab/membership/MembersSheetFrame';
import {
  RosterErrorState,
  RosterRow,
  RosterSkeleton,
} from '@/v2/features/collab/membership/RosterRow';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
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
 * THE ROSTER IS ALREADY WARM WHEN THIS OPENS, AND THAT IS WHY IT IS MOUNTED
 * WHERE IT IS. `CollabFrame` mounts the same roster key on the SPACE route
 * (the lobby's People block reads it), so this sheet's own `enabled: open`
 * query resolves to a populated cache entry and paints rows rather than a
 * skeleton — v1's lazy-fetch-on-open is deliberately NOT the shape here. The
 * gate is kept anyway so the sheet is self-sufficient wherever it is mounted.
 *
 * It is NOT reachable from a channel route: `?roster=1` is refused there, both
 * because the roster query is not mounted (so it would open cold) and, more
 * importantly, because the `?invite=` param below would then have two owners
 * on one screen — see the rule in `CollabFrame`.
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

  /** Leave and transfer stay OUT of the URL: both are destructive confirmations
   *  holding a target and an error from the last attempt, and a link that
   *  re-opens "Make X the owner?" on refresh is an armed trigger. */
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

  /**
   * Invite gets its OWN param rather than a value of the screen's `?panel=`,
   * because it opens ON TOP of this sheet and one param holds one value. The
   * URL reads `?panel=members&invite=1`, and Back unwinds them in the order
   * they were opened: invite first, then the roster.
   *
   * Gated on the same `canManage` the button is, so `?invite=1` in a copied
   * link cannot open the invite form for someone who may not invite.
   */
  const invitePanel = useUrlOverlay('invite', { canOpen: canManage });

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
            onClick={() => invitePanel.show()}
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

      {/* KEYED LIKE EVERY OTHER FORM DIALOG, and it must be. This dialog resets
          its fields, its error line and its throttle rest inside its own close
          path — which Radix never reaches when Back closes it, because an
          external `open` prop change fires no `onOpenChange`. Without the
          remount, a 429 dismissed with Back came straight back on the next
          opening, address and all. */}
      <InvitePeopleDialog
        key={invitePanel.keyFor()}
        open={invitePanel.open}
        onOpenChange={invitePanel.setOpen}
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
