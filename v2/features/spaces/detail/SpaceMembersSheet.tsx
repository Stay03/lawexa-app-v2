'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  Hourglass,
  Link2,
  Loader2,
  LogOut,
  Trash2,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

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
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { Member, Space } from '@/types/collab';
import { COLLAB_DIALOG_SURFACE } from '@/v2/features/collab/kit/dialog-surface';
import { InvitePeopleDialog } from '@/v2/features/collab/membership/InvitePeopleDialog';
import type { InviteIdentifier } from '@/v2/features/collab/membership/invite-identifier';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import { MembersSheetFrame } from '@/v2/features/collab/membership/MembersSheetFrame';
import {
  RosterErrorState,
  RosterSkeleton,
} from '@/v2/features/collab/membership/RosterRow';
import { InviteLinksPanel } from '@/v2/features/invites/InviteLinksPanel';
import { SpaceJoinRequestsPanel } from '@/v2/features/invites/JoinRequestsPanel';
import { useInviteLinks, useSpaceJoinRequests } from '@/v2/features/invites/queries';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import {
  canManageMembership,
  contentRoleInRoster,
  inviteRoleOptions,
  invitePayload,
  isLastOwnerLeaveError,
  isMembershipOwner,
  isOwnerMustTransferError,
  isSharedSpace,
  memberCountLabel,
  othersInSpace,
  roleInRoster,
  rosterCountLabel,
  spaceKind,
  spaceLeaveRoute,
  splitRoster,
  type MembersSheetView,
} from '../model';
import {
  useInviteSpaceMember,
  useLeaveSpace,
  useTransferSpaceOwnership,
} from '../mutations';
import { spacesQueries } from '../queries';
import { useSpaceRosterRow } from './people/use-roster-row';

/**
 * SpaceMembersSheet — roster, role management, ownership transfer, invites,
 * invite links, the waiting list and leave for one space (study A2: KEEP —
 * "dense, correct, complete" — ported onto v2 primitives and the shared roster
 * row).
 *
 * ── LEAVING NEVER ENDS IN A DEAD END (design round 1, 12 October 2026) ─────
 * The sheet used to offer every member "Leave space" and then refuse the last
 * Owner with a dialog whose only button closed it. Now what Leave leads to is
 * decided before anyone presses it (`spaceLeaveRoute`):
 *  - the last Owner of a shared space with nobody else in it gets "Delete
 *    space" in Leave's place, the one way out there is;
 *  - the last Owner with others in it gets "Choose a new owner first", whose
 *    primary action lists the people they can hand the space to, confirms the
 *    transfer, and then asks the leave question again;
 *  - everyone else gets the plain confirmation.
 * The server's refusals are still read (a team owner's **400**, a shared last
 * Owner's **409** when the roster had not landed) and land in the same
 * designed states, keyed on the STATUS, never on the copy (§F.5's anti-oracle
 * rule). They never reach the global error toast (`silentError`).
 *
 * THE LEAVE CONFIRMATION'S OPEN STATE BELONGS TO THE FRAME, because the space
 * menu's "Leave space" opens the same dialog while this sheet is closed. It
 * stays OUT of the URL like every destructive confirm here: a link that
 * re-opens "Leave this space?" on refresh is an armed trigger.
 *
 * ── WHAT TRANSFER ACTUALLY DOES, SAID OUT LOUD ─────────────────────────────
 * The old owner is DEMOTED server-side (digest §C): to admin on a team space,
 * to Contributor on a shared one. The confirmation says so, because "transfer
 * ownership" alone reads as "and then I leave", which is not what happens.
 *
 * ── MEMBERS, THEN THE INVITED, COUNTED APART ───────────────────────────────
 * A pending invitee used to sit in the same list as the members, with the
 * same row, under a count that left them out: the owner counted five faces
 * and read "4 members". The roster is two groups now, members and then an
 * "Invited" heading, and the count line says both ("4 members · 1 invited"),
 * so the number is the number of rows.
 *
 * ── INVITE LINKS AND THE WAITING LIST ARE STEPS INSIDE THE SHEET ───────────
 * They were sheets of their own behind the space menu, so an Owner looking at
 * the people never saw that links existed. They are views of this sheet now,
 * carried by the frame's `?roster=` value (`links`, `requests`), with a back
 * control to the roster; the space menu opens them on the same values. Moving
 * between them replaces the entry, so Back closes the sheet from any of them.
 *
 * THE ROSTER IS ALREADY WARM WHEN THIS OPENS, AND THAT IS WHY IT IS MOUNTED
 * WHERE IT IS. `CollabFrame` mounts the same roster key on the SPACE route
 * (the lobby's People block reads it), so this sheet's own query resolves to a
 * populated cache entry and paints rows rather than a skeleton. The query is
 * enabled while the sheet or the leave confirmation is open, so the leave
 * decision reads a fresh roster wherever it was opened from.
 *
 * It is NOT reachable from a channel route: `?roster=` is refused there, both
 * because the roster query is not mounted (so it would open cold) and, more
 * importantly, because the `?invite=` param below would then have two owners
 * on one screen — see the rule in `CollabFrame`.
 *
 * Rows key on `member.user.uuid` — the member surface is uuid-only (§F.4).
 * Phase-5 W4, 2026-08-04.
 *
 * ── A SHARED SPACE (Spaces F7, 12 October 2026; backend B2) ────────────────
 * Its people are Owner, Contributor and Viewer, and only the Owner manages them:
 * invites (as Contributor or Viewer), role changes, removals and links, all read
 * off the CONTENT role (`canManageMembership`), never the old `my_role`. A
 * team space keeps everything above exactly. Leaving a shared space keeps what
 * the leaver added in it (design 2.5), so the leave confirmation promises
 * nothing goes with them.
 */
export function SpaceMembersSheet({
  space,
  viewerId,
  viewerUuid,
  open,
  onOpenChange,
  view,
  onViewChange,
  inviteArrivalKey,
  leaveOpen,
  onLeaveOpenChange,
  onDeleteSpace,
}: {
  space: Space;
  viewerId: number | null;
  viewerUuid: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which step of the sheet is showing (the frame's `?roster=` value). */
  view: MembersSheetView;
  /** Move between steps in place (a replace, so Back still closes the sheet). */
  onViewChange: (view: MembersSheetView) => void;
  /** Changes on every arrival at the `invite` view, so the invite dialog
   *  opened that way starts clean each time. */
  inviteArrivalKey: string;
  leaveOpen: boolean;
  onLeaveOpenChange: (open: boolean) => void;
  /** Opens the frame's delete confirmation (the last Owner, alone). */
  onDeleteSpace: () => void;
}) {
  const router = useRouter();

  /** Transfer stays OUT of the URL: it is a destructive confirmation holding a
   *  target and an error from the last attempt, and a link that re-opens
   *  "Make X the owner?" on refresh is an armed trigger. */
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  /** The server refused the leave (a team owner's 400, a last Owner's 409):
   *  the confirmation shows the designed way forward instead. */
  const [leaveRefused, setLeaveRefused] = useState(false);
  // Every OPENING of the leave confirmation starts from the plain question,
  // whichever door opened it (the footer here, or the space menu through the
  // frame). Adjusted during render, keyed on the previous value, React's
  // sanctioned way to reset state from a changed input. Closing changes
  // nothing, so the dialog keeps its words while it fades out.
  const [seenLeaveOpen, setSeenLeaveOpen] = useState(leaveOpen);
  if (leaveOpen !== seenLeaveOpen) {
    setSeenLeaveOpen(leaveOpen);
    if (leaveOpen) setLeaveRefused(false);
  }
  /** The list of people the last Owner can hand the space to. */
  const [pickingOwner, setPickingOwner] = useState(false);
  /** Set when the transfer was started from Leave, so a successful transfer
   *  goes straight back to the leave question. */
  const [leaveAfterTransfer, setLeaveAfterTransfer] = useState(false);
  /** The viewer handed the space over in this sheet. Until the roster has
   *  re-read, it would still name them the last Owner. */
  const [handedOver, setHandedOver] = useState(false);

  const membersQuery = useQuery({
    ...spacesQueries.members(space.uuid, { viewerId }),
    enabled: open || leaveOpen,
  });

  const invite = useInviteSpaceMember(space.uuid);
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

  // A step an Owner opened can never be shown to anyone else: the frame's
  // param gate strips it, and this is the same rule once the roster lands.
  const step = canManage ? view : 'members';

  const { joined, invited } = splitRoster(members);
  const countLine = membersQuery.isSuccess
    ? rosterCountLabel(joined.length, invited.length)
    : memberCountLabel(space.active_members_count);

  const others = othersInSpace(members, viewerUuid);
  const leaveRoute = handedOver
    ? 'leave'
    : spaceLeaveRoute(space, members, viewerUuid, membersQuery.isSuccess);
  /** What the leave dialog shows: the plain question, the hand-over step, or
   *  (the last Owner alone, reached only through a late 409) delete. */
  const leaveStep: 'confirm' | 'choose-owner' | 'delete' = leaveRefused
    ? others.length > 0 || !shared
      ? 'choose-owner'
      : 'delete'
    : leaveRoute === 'choose-new-owner'
      ? 'choose-owner'
      : leaveRoute === 'delete-instead'
        ? 'delete'
        : 'confirm';

  const links = useInviteLinks(space.uuid, open && canManage);
  const requests = useSpaceJoinRequests(space.uuid, open && canManage);
  const liveLinks = links.data?.data.filter((link) => link.is_usable).length;
  const waiting = requests.data?.data.length;

  /**
   * Invite gets its OWN param rather than a value of `?roster=`, because it
   * opens ON TOP of this sheet and one param holds one value. The URL reads
   * `?roster=1&invite=1`, and Back unwinds them in the order they were
   * opened: invite first, then the roster.
   *
   * The ONE exception is an empty space's "Invite people", which arrives with
   * the dialog already open (`?roster=invite`): there it is a step of the
   * sheet, and closing it returns to the roster in place.
   *
   * Gated on the same `canManage` the button is, so `?invite=1` in a copied
   * link cannot open the invite form for someone who may not invite.
   */
  const invitePanel = useUrlOverlay('invite', { canOpen: canManage });
  const inviteFromStep = step === 'invite';

  // The roles this space speaks in, and the request each one becomes: Viewer
  // or Contributor as `content_role` on a shared space, today's role on a team one.
  // Either kind invites by email or by username, one of the two per request.
  const kind = spaceKind(space);
  const inviteRoles = inviteRoleOptions(kind);
  const handleInvite = ({ invitee, role }: { invitee: InviteIdentifier; role: string }) =>
    new Promise<void>((resolve, reject) => {
      const payload = invitePayload(kind, invitee, role);
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

  const closeLeave = () => onLeaveOpenChange(false);

  const handleTransfer = () => {
    if (!transferTarget) return;
    setTransferError(null);
    transfer.mutate(
      { user_uuid: transferTarget.user.uuid },
      {
        onSuccess: () => {
          setTransferTarget(null);
          setHandedOver(true);
          if (leaveAfterTransfer) {
            // They came here to leave: ask that question again, now that it
            // can be answered.
            setLeaveAfterTransfer(false);
            onLeaveOpenChange(true);
          }
        },
        onError: (error) => setTransferError(extractApiError(error).message),
      },
    );
  };

  const handleLeave = () => {
    setLeaveRefused(false);
    leave.mutate(undefined, {
      onSuccess: () => {
        closeLeave();
        onOpenChange(false);
        router.push('/spaces');
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        if (
          (shared && isLastOwnerLeaveError(apiError.status)) ||
          isOwnerMustTransferError(apiError.status)
        ) {
          setHandedOver(false);
          setLeaveRefused(true);
          return;
        }
        // Anything else is a genuine failure: close the confirmation and let
        // the ONE global mutation-error channel say so.
        closeLeave();
      },
    });
  };

  // One row, shared with the People tab (people/use-roster-row.tsx); handing
  // the space over stays here, with its confirmation.
  const rosterRow = useSpaceRosterRow({
    space,
    viewerUuid,
    canManage,
    shared,
    onTransferOwnership: isOwner
      ? (target) => {
          setTransferError(null);
          setLeaveAfterTransfer(false);
          setTransferTarget(target);
        }
      : undefined,
  });

  const backToMembers = () => onViewChange('members');
  /** On a step of its own (links, the waiting list), not the roster. */
  const inStep = step === 'links' || step === 'requests';

  return (
    <>
      {/* ONE FRAME FOR EVERY STEP, so moving between the roster and a step
          swaps the body inside a panel that stays put, rather than closing
          one sheet and sliding another in. */}
      <MembersSheetFrame
        open={open}
        onOpenChange={onOpenChange}
        title={STEP_TITLE[step]}
        subtitle={
          step === 'links'
            ? 'Make links people can use to join. Each link says whether you approve who joins.'
            : step === 'requests'
              ? 'People who used a link that needs your approval.'
              : `${space.name} · ${countLine}`
        }
        onBack={inStep ? backToMembers : undefined}
        backLabel="Back to members"
        footer={
          inStep ? undefined : leaveRoute === 'delete-instead' ? (
            <Button
              variant="ghost"
              className="v2-interactive w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDeleteSpace}
            >
              <Trash2 aria-hidden className="size-4" />
              Delete space
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="v2-interactive w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onLeaveOpenChange(true)}
            >
              <LogOut aria-hidden className="size-4" />
              Leave space
            </Button>
          )
        }
      >
        {step === 'links' ? (
          <div key="links" className={STEP_FADE}>
            <InviteLinksPanel spaceUuid={space.uuid} contentRoles={shared} />
          </div>
        ) : step === 'requests' ? (
          <div key="requests" className={STEP_FADE}>
            <SpaceJoinRequestsPanel spaceUuid={space.uuid} contentRoles={shared} />
          </div>
        ) : (
          <div key="members" className={cn('space-y-4', STEP_FADE)}>
            {canManage && (
              <div className="space-y-1">
                <Button
                  variant="outline"
                  className="v2-interactive w-full"
                  onClick={() => invitePanel.show()}
                >
                  <UserPlus aria-hidden className="size-4" />
                  Invite people
                </Button>
                <SheetStepRow
                  icon={Link2}
                  label="Invite links"
                  meta={
                    liveLinks === undefined
                      ? null
                      : liveLinks === 0
                        ? 'None working'
                        : `${liveLinks} working`
                  }
                  onClick={() => onViewChange('links')}
                />
                <SheetStepRow
                  icon={Hourglass}
                  label="Waiting to join"
                  meta={
                    waiting === undefined
                      ? null
                      : waiting === 0
                        ? 'Nobody waiting'
                        : `${waiting} waiting`
                  }
                  onClick={() => onViewChange('requests')}
                />
              </div>
            )}

            {membersQuery.isPending ? (
              <RosterSkeleton />
            ) : membersQuery.isError ? (
              <RosterErrorState onRetry={() => void membersQuery.refetch()} />
            ) : (
              <>
                <div className="divide-y divide-border/60">
                  {joined.map((member) => rosterRow(member))}
                </div>
                {invited.length > 0 ? (
                  <section aria-labelledby="space-roster-invited">
                    <h3
                      id="space-roster-invited"
                      className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                      Invited
                    </h3>
                    <div className="divide-y divide-border/60">
                      {invited.map((member) => rosterRow(member, true))}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        )}
      </MembersSheetFrame>

      {/* KEYED LIKE EVERY OTHER FORM DIALOG, and it must be. This dialog resets
          its fields, its error line and its throttle rest inside its own close
          path — which Radix never reaches when Back closes it, because an
          external `open` prop change fires no `onOpenChange`. Without the
          remount, a 429 dismissed with Back came straight back on the next
          opening, address and all. Both doors count: the button's own param
          and an arrival at the `invite` step. */}
      <InvitePeopleDialog
        key={`${invitePanel.keyFor()}|${inviteArrivalKey}`}
        open={invitePanel.open || inviteFromStep}
        onOpenChange={(next) => {
          if (next) return;
          if (inviteFromStep) backToMembers();
          else invitePanel.setOpen(false);
        }}
        title={`Invite to ${space.name}`}
        description="They get an invitation they can accept from their own Invitations page."
        roles={inviteRoles}
        identifier="email-or-username"
        onInvite={handleInvite}
        linkScope={{ spaceUuid: space.uuid, contentRoles: shared }}
      />

      {/* WHO TAKES OVER: the last Owner's way out of Leave. Only joined,
          active members, the ones the server will hand a space to. */}
      <AlertDialog
        open={pickingOwner}
        onOpenChange={(next) => {
          setPickingOwner(next);
          if (!next) setLeaveAfterTransfer(false);
        }}
      >
        <AlertDialogContent className={COLLAB_DIALOG_SURFACE}>
          <AlertDialogHeader>
            <AlertDialogTitle>Choose the new owner</AlertDialogTitle>
            <AlertDialogDescription>
              {shared
                ? `They take over ${space.name} and you become a Contributor. Then you can leave.`
                : `They take over ${space.name} and you become an admin. Then you can leave.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="-mx-2 flex max-h-[min(18rem,50vh)] flex-col gap-0.5 overflow-y-auto overscroll-contain">
            {others.map((member) => (
              <li key={member.user.uuid}>
                <button
                  type="button"
                  onClick={() => {
                    setPickingOwner(false);
                    setTransferError(null);
                    setTransferTarget(member);
                  }}
                  className={cn(
                    'v2-interactive flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary/60 motion-reduce:transition-none',
                    FOCUS_RING,
                  )}
                >
                  <MemberAvatar user={member.user} size="sm" className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {member.user.name}
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={transferTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setTransferTarget(null);
            setTransferError(null);
            setLeaveAfterTransfer(false);
          }
        }}
      >
        <AlertDialogContent className={COLLAB_DIALOG_SURFACE}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Make {transferTarget?.user.name} the owner?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {shared
                ? `They take over ${space.name}, and you become a Contributor. Only the new owner can hand it back.`
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
        onOpenChange={onLeaveOpenChange}
      >
        <AlertDialogContent className={COLLAB_DIALOG_SURFACE}>
          {leaveStep === 'choose-owner' ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Choose a new owner first</AlertDialogTitle>
                <AlertDialogDescription>
                  {`You’re the only owner of ${space.name}. Make another member the owner, then you can leave.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={others.length === 0}
                  onClick={() => {
                    closeLeave();
                    setLeaveAfterTransfer(true);
                    setPickingOwner(true);
                  }}
                >
                  Choose new owner
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : leaveStep === 'delete' ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Nobody to hand it to</AlertDialogTitle>
                <AlertDialogDescription>
                  {`You’re the only member of ${space.name}, so it can’t be left without an owner. Delete the space if you no longer need it.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    closeLeave();
                    onDeleteSpace();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete space
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
                    ? 'You lose access to this space. The conversations, folders and files you added stay in it for the other members. Someone can invite you back.'
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

/** The sheet's title on each step; the `invite` step is the roster under the
 *  invite dialog. */
const STEP_TITLE: Readonly<Record<MembersSheetView, string>> = {
  members: 'Members',
  invite: 'Members',
  links: 'Invite links',
  requests: 'Waiting to join',
};

/** A step's body arriving: the house content fade, no movement. */
const STEP_FADE = 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200';

/**
 * A quiet row under "Invite people" that opens a step of the sheet: the icon,
 * the label, what is there now, and a chevron that says it goes somewhere.
 */
function SheetStepRow({
  icon: Icon,
  label,
  meta,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  /** "2 working", "Nobody waiting"; `null` while it is not known yet. */
  meta: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'v2-interactive flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-foreground',
        'transition-colors duration-150 hover:bg-secondary/60 motion-reduce:transition-none',
        FOCUS_RING,
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta ? (
        <span className="shrink-0 text-xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
          {meta}
        </span>
      ) : null}
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
