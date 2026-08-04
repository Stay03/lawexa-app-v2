'use client';

import { MoreHorizontal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Member } from '@/types/collab';
import { MemberAvatar } from '../ui/avatars';

/**
 * MemberRow — one roster line with the optional owner/admin management menu.
 * A v2 port of v1's shared `MemberListItem` (study A2: KEEP — "dense,
 * correct, complete"); W4's space/org sheets re-adopt this same row. The
 * owner can't be demoted or removed through these endpoints, and members
 * manage themselves via leave — so self rows never show a menu. Phase-5 W2,
 * 2026-08-04.
 */
export function MemberRow({
  member,
  isSelf = false,
  onPromote,
  onDemote,
  onRemove,
}: {
  member: Member;
  isSelf?: boolean;
  onPromote?: (member: Member) => void;
  onDemote?: (member: Member) => void;
  onRemove?: (member: Member) => void;
}) {
  const isOwner = member.role === 'owner';
  const canPromote = !isSelf && !isOwner && !!onPromote && member.role === 'member';
  const canDemote = !isSelf && !isOwner && !!onDemote && member.role === 'admin';
  const canRemove = !isSelf && !isOwner && !!onRemove;
  const hasMenu = canPromote || canDemote || canRemove;

  return (
    <div className="flex min-h-11 items-center gap-3 py-2">
      <MemberAvatar user={member.user} size="sm" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{member.user.name}</span>
          {isSelf && <span className="text-xs text-muted-foreground">You</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground capitalize">
            {member.role_label ?? member.role}
          </span>
          {member.is_pending && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
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
              className="size-7 shrink-0"
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
            {canRemove && (
              <>
                {(canPromote || canDemote) && <DropdownMenuSeparator />}
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
