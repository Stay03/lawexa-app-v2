'use client';

import {
  Bookmark,
  CornerUpLeft,
  Pencil,
  Pin,
  PinOff,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { Message } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useEngagementThrottled } from '../engagement-throttle';
import { ReactionTrayRow } from './reactions';

/**
 * MessageActionsSheet — the TOUCH half of the row-actions contract: one
 * bottom sheet per FEED (never per row), opened by a long-press, mirroring
 * the hover cluster's actions with thumb-zone targets, an explicit Cancel,
 * and destructive red (design-research DIRECTIONS 5/12; standards §4).
 * Phase-5 W2, extended in W3 with reactions, save and pin — 2026-08-04.
 *
 * THE REACTION TRAY LEADS. It is the most-used action and the one that wants
 * the least ceremony, so it sits at the top as a row of thumb-sized keys
 * (44px, the HIG floor) and closes the sheet on pick — one gesture in, one
 * gesture out. Everything below it is the same list W2 shipped, in the same
 * order as the desktop cluster so the two input worlds never disagree about
 * where an action lives.
 */
export function MessageActionsSheet({
  message,
  canEdit,
  canDelete,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onTogglePin,
  onToggleSave,
  onViewAiSession,
}: {
  /** The long-pressed message; `null` = closed. */
  message: Message | null;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onToggleReaction: (message: Message, emoji: string) => void;
  onTogglePin: (message: Message) => void;
  onToggleSave: (message: Message) => void;
  onViewAiSession: (sessionUuid: string) => void;
}) {
  const open = message !== null;
  const reactionThrottled = useEngagementThrottled('reaction');
  const saveThrottled = useEngagementThrottled('bookmark');
  const pinned = message?.is_pinned === true;
  const saved = message?.is_bookmarked === true;
  const sessionUuid =
    message?.is_ai === true ? (message.metadata.session_uuid ?? null) : null;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom" className="v2-safe-bottom rounded-t-2xl">
        <SheetHeader className="pb-0">
          <SheetTitle className="truncate text-sm text-muted-foreground">
            {message
              ? (message.is_ai ? 'Lawexa' : (message.author?.name ?? 'Deleted member'))
              : ''}
          </SheetTitle>
        </SheetHeader>
        {message && (
          <div className="flex flex-col px-2 pb-2">
            {/* The tray scrolls horizontally on narrow phones rather than
                wrapping to a second row — a reaction picker that changes
                height as you look at it is a moving target for a thumb. */}
            <div className="v2-quiet-scroll -mx-1 mb-1 overflow-x-auto px-1 pb-1">
              <ReactionTrayRow
                reactions={message.reactions}
                disabled={reactionThrottled}
                size="touch"
                onPick={(emoji) => {
                  onClose();
                  onToggleReaction(message, emoji);
                }}
              />
            </div>

            <SheetAction
              label="Reply"
              onClick={() => {
                onClose();
                onReply(message);
              }}
            >
              <CornerUpLeft aria-hidden className="size-4" />
            </SheetAction>
            <SheetAction
              label={saved ? 'Remove from saved' : 'Save message'}
              pressed={saved}
              disabled={saveThrottled}
              onClick={() => {
                onClose();
                onToggleSave(message);
              }}
            >
              <Bookmark
                aria-hidden
                className={cn('size-4', saved && 'fill-current')}
              />
            </SheetAction>
            <SheetAction
              label={pinned ? 'Unpin from channel' : 'Pin to channel'}
              pressed={pinned}
              onClick={() => {
                onClose();
                onTogglePin(message);
              }}
            >
              {pinned ? (
                <PinOff aria-hidden className="size-4" />
              ) : (
                <Pin aria-hidden className="size-4" />
              )}
            </SheetAction>
            {sessionUuid && (
              <SheetAction
                label="View this Lawexa conversation"
                onClick={() => {
                  onClose();
                  onViewAiSession(sessionUuid);
                }}
              >
                <Sparkles aria-hidden className="size-4" />
              </SheetAction>
            )}
            {canEdit && (
              <SheetAction
                label="Edit message"
                onClick={() => {
                  onClose();
                  onEdit(message);
                }}
              >
                <Pencil aria-hidden className="size-4" />
              </SheetAction>
            )}
            {canDelete && (
              <SheetAction
                label="Delete message"
                destructive
                onClick={() => {
                  onClose();
                  onDelete(message);
                }}
              >
                <Trash2 aria-hidden className="size-4" />
              </SheetAction>
            )}
            <Button
              type="button"
              variant="outline"
              className="mt-2 min-h-11 w-full"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** One sheet row. `pressed` is `undefined` for plain verbs and a boolean for
 *  the two toggles — same rule as the desktop cluster's `RowAction`. */
function SheetAction({
  label,
  destructive = false,
  pressed,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  destructive?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'v2-interactive flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium',
        'transition-colors duration-150 motion-reduce:transition-none',
        destructive
          ? 'text-destructive active:bg-destructive/10'
          : pressed
            ? 'text-primary active:bg-primary/10'
            : 'text-foreground active:bg-muted',
        disabled && 'pointer-events-none opacity-50',
        FOCUS_RING,
      )}
    >
      {children}
      {label}
    </button>
  );
}
