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
import type { Member, Space } from '@/types/collab';
import { InvitePeopleDialog } from '@/v2/features/collab/membership/InvitePeopleDialog';
import { MembersSheetFrame } from '@/v2/features/collab/membership/MembersSheetFrame';
import {
  RosterErrorState,
  RosterRow,
  RosterSkeleton,
} from '@/v2/features/collab/membership/RosterRow';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import {
  canManageMembership,
  contentRoleChangePayload,
  contentRoleInRoster,
  inviteRoleOptions,
  invitePayload,
  isLastOwnerLeaveError,
  isLastSharedOwner,
  isMembershipOwner,
  isOwnerMustTransferError,
  isSharedSpace,
  memberCountLabel,
  roleInRoster,
  spaceKind,
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
 *
 * ── A SHARED SPACE (Spaces F7, 12 October 2026; backend B2) ────────────────
 * Its people are Owner, Editor and Viewer, and only the Owner manages them:
 * invites (as Editor or Viewer), role changes, removals and links, all read
 * off the CONTENT role (`canManageMembership`), never the old `my_role`. A
 * team space keeps everything above exactly. Two things change in what the
 * sheet SAYS: transferring a shared space makes the old Owner an Editor, and
 * leaving keeps what the leaver added in the space (design 2.5), so the leave
 * confirmation promises nothing goes with them. The LAST Owner cannot leave a
 * shared space (the backend answers 409: delete the space or transfer first),
 * so the sheet answers before the request, with the same designed refusal the
 * team owner's 400 gets, and still reads a 409 if one arrives anyway.
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
  // stamps are the fallback for the first frame before it lands.
  const myRole = roleInRoster(members, viewerUuid) ?? space.my_role ?? null;
  const myContentRole =
    contentRoleInRoster(members, viewerUuid) ?? space.my_content_role ?? null;
  const shared = isSharedSpace(space);
  const membership = {
    kind: space.kind,
    my_role: myRole,
    my_content_role: myContentRole,
  };
  const isOwner = isMembershipOwner(membership);
  const canManage = canManageMembership(membership);
  // Known only once the roster has landed: before that the sheet cannot say
  // who else owns the space, so it lets the server decide (and reads its 409).
  const lastSharedOwner =
    membersQuery.isSuccess && isLastSharedOwner(space, members, viewerUuid);
  /**
   * The designed refusal for the last Owner of a shared space (backend B2:
   * 409, whether or not others remain). It leads with transferring ownership,
   * the way out backend names; with nobody else active in the space there is
   * no one to transfer to, so it names deleting the space instead.
   */
  const othersActive = members.some(
    (member) => member.is_active && member.user.uuid !== viewerUuid,
  );
  const lastOwnerSentence = othersActive
    ? `You're the only owner of ${space.name}. Transfer ownership first: open another member's menu in this list and choose "Transfer ownership". Then you can leave.`
    : `You're the only owner of ${space.name}, and nobody else is in it. Delete the space from the menu at the top of the space page instead.`;

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

  // The roles this space speaks in, and the request each one becomes: Viewer
  // or Editor as `content_role` on a shared space, today's role on a team one.
  const kind = spaceKind(space);
  const inviteRoles = inviteRoleOptions(kind);
  const handleInvite = ({ email, role }: { email: string; role: string }) =>
    new Promise<void>((resolve, reject) => {
      const payload = invitePayload(kind, email, role);
      if (payload === null) {
        // Only a role the list above offered can arrive here.
        reject(new Error('Choose a role for them first.'));
        return;
      }
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
        if (shared && isLastOwnerLeaveError(apiError.status)) {
          // Our sentence, not the server's: it names the way out here.
          setMustTransfer(lastOwnerSentence);
          return;
        }
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
              // The last Owner of a shared space meets the refusal before any
              // request: it is already known, and a confirm that only 409s
              // would be a button that lies.
              setMustTransfer(lastSharedOwner ? lastOwnerSentence : null);
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
        roles={inviteRoles}
        onInvite={handleInvite}
        linkScope={{ spaceUuid: space.uuid, contentRoles: shared }}
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
              {shared
                ? `They take over ${space.name}, and you become an Editor. Only the new owner can hand it back.`
                : `They take over ${space.name}, and you become an admin. Only the new owner can hand it back.`}
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
                <AlertDialogTitle>
                  {shared && !othersActive ? 'You are the only owner' : 'Transfer ownership first'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {/* A shared space's sentence already names both ways out;
                      the team one adds where the transfer lives. */}
                  {shared
                    ? mustTransfer
                    : `${mustTransfer} Open a member’s menu in this list and choose “Transfer ownership”, then you can leave.`}
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
                  {/* What a member added stays when they go (design 2.5), so a
                      shared space's confirmation says that rather than
                      implying their chats, folders and files leave with them. */}
                  {shared
                    ? 'You lose access to this space. The chats, folders and files you added stay in it for the other members. Someone can invite you back.'
                    : 'You lose access to this space and every channel in it. Someone can invite you back.'}
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
