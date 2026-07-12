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

import { MemberAvatar } from './MemberAvatar';

interface MemberListItemProps {
  member: Member;
  isSelf?: boolean;
  onPromote?: (member: Member) => void;
  onDemote?: (member: Member) => void;
  onTransferOwnership?: (member: Member) => void;
  onRemove?: (member: Member) => void;
}

/** A roster row with optional owner/admin management actions. */
export function MemberListItem({
  member,
  isSelf = false,
  onPromote,
  onDemote,
  onTransferOwnership,
  onRemove,
}: MemberListItemProps) {
  const isOwner = member.role === 'owner';
  // The owner can't be demoted or removed through these endpoints, and members
  // manage themselves via leave — so self rows never show management actions.
  const canPromote = !isSelf && !isOwner && !!onPromote && member.role === 'member';
  const canDemote = !isSelf && !isOwner && !!onDemote && member.role === 'admin';
  const canTransfer = !isSelf && !isOwner && !!onTransferOwnership;
  const canRemove = !isSelf && !isOwner && !!onRemove;
  const hasMenu = canPromote || canDemote || canTransfer || canRemove;

  return (
    <div className="flex items-center gap-3 py-2">
      <MemberAvatar user={member.user} size="sm" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{member.user.name}</span>
          {isSelf && <span className="text-xs text-muted-foreground">You</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs capitalize text-muted-foreground">
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
              className="h-7 w-7 shrink-0"
              aria-label={`Manage ${member.user.name}`}
            >
              <MoreHorizontal className="h-4 w-4" />
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
                {(canPromote || canDemote || canTransfer) && (
                  <DropdownMenuSeparator />
                )}
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
