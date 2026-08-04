'use client';

import { Crown, MoreHorizontal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import type { Member } from '@/types/collab';
import { MemberAvatar } from './MemberAvatar';

/**
 * RosterRow — ONE roster line, shared by the space members sheet and the
 * organization members sheet (study A2/A8: the shared roster row stays one
 * component). A v2 rebuild of v1's `MemberListItem`, in the house row anatomy:
 * leading mark → name (+ "You") / role line → trailing menu, `min-h-11` so the
 * touch target clears 44px even on the shortest row.
 *
 * THE MENU'S RULES ARE THE ENDPOINTS' RULES, not decoration: the owner cannot
 * be demoted or removed through `PUT/DELETE .../members/{userUuid}`, and a
 * member manages their own membership by leaving — so the owner row and the
 * viewer's own row never offer a menu. `onTransferOwnership` is passed only by
 * the space sheet (organizations have no transfer endpoint), which is why it
 * is optional rather than a flag.
 *
 * Rows key on `member.user.uuid` at the call site — the member surface is
 * uuid-only (digest §F.4). Phase-5 W4, 2026-08-04.
 */
export function RosterRow({
  member,
  isSelf = false,
  onPromote,
  onDemote,
  onTransferOwnership,
  onRemove,
}: {
  member: Member;
  isSelf?: boolean;
  onPromote?: (member: Member) => void;
  onDemote?: (member: Member) => void;
  /** Space rosters only — organizations have no ownership-transfer route. */
  onTransferOwnership?: (member: Member) => void;
  onRemove?: (member: Member) => void;
}) {
  const isOwner = member.role === 'owner';
  const canPromote = !isSelf && !isOwner && !!onPromote && member.role === 'member';
  const canDemote = !isSelf && !isOwner && !!onDemote && member.role === 'admin';
  // Ownership may only pass to an ACTIVE member — a pending invitee has not
  // accepted yet, and the server would refuse.
  const canTransfer =
    !isSelf && !isOwner && !!onTransferOwnership && member.is_active && !member.is_pending;
  const canRemove = !isSelf && !isOwner && !!onRemove;
  const hasMenu = canPromote || canDemote || canTransfer || canRemove;

  return (
    <div className="flex min-h-11 items-center gap-3 py-2">
      <MemberAvatar user={member.user} size="sm" className="shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {member.user.name}
          </span>
          {isSelf && (
            <span className="shrink-0 text-xs text-muted-foreground">You</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isOwner && (
            <Crown aria-hidden className="size-3 shrink-0 text-primary" />
          )}
          <span className="text-xs capitalize text-muted-foreground">
            {member.role_label || member.role}
          </span>
          {member.is_pending && (
            <Badge variant="outline" className="h-4 px-1 text-[10px] font-medium">
              Pending
            </Badge>
          )}
        </div>
      </div>

      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="v2-interactive size-8 shrink-0"
              aria-label={`Manage ${member.user.name}`}
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canPromote && (
              <DropdownMenuItem onClick={() => onPromote?.(member)}>
                Make admin
              </DropdownMenuItem>
            )}
            {canDemote && (
              <DropdownMenuItem onClick={() => onDemote?.(member)}>
                Change to member
              </DropdownMenuItem>
            )}
            {canTransfer && (
              <DropdownMenuItem onClick={() => onTransferOwnership?.(member)}>
                Transfer ownership
              </DropdownMenuItem>
            )}
            {canRemove && (
              <>
                {(canPromote || canDemote || canTransfer) && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onRemove?.(member)}
                >
                  Remove
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/**
 * The roster's pending shape — four rows at {@link RosterRow}'s exact geometry
 * with the house progressive-opacity fade, so the hand-off to real names is
 * content resolving rather than a layout swap.
 */
export function RosterSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="flex min-h-11 items-center gap-3 py-2"
          style={{ opacity: Math.max(0.3, 1 - index * 0.2) }}
        >
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2 rounded" />
            <Skeleton className="h-3 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Roster load failure — distinct from an empty roster (which cannot happen:
 *  a roster always contains at least the viewer), with a real in-place retry. */
export function RosterErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-6 text-center text-sm">
      <p className="text-muted-foreground">Couldn&rsquo;t load the member list.</p>
      <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
