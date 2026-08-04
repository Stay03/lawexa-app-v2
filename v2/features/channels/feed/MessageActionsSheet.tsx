'use client';

import { CornerUpLeft, Pencil, Trash2 } from 'lucide-react';

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

/**
 * MessageActionsSheet — the TOUCH half of the row-actions contract: one
 * bottom sheet per FEED (never per row), opened by a long-press, mirroring
 * the hover cluster's actions with thumb-zone targets, an explicit Cancel,
 * and destructive red (design-research DIRECTIONS 5/12; standards §4).
 * Phase-5 W2, 2026-08-04. W3 appends React / Pin / Save rows to the same
 * list — it is a plain stack of action rows, extensible by design.
 */
export function MessageActionsSheet({
  message,
  canEdit,
  canDelete,
  onClose,
  onReply,
  onEdit,
  onDelete,
}: {
  /** The long-pressed message; `null` = closed. */
  message: Message | null;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
}) {
  const open = message !== null;

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
            <SheetAction
              label="Reply"
              onClick={() => {
                onClose();
                onReply(message);
              }}
            >
              <CornerUpLeft aria-hidden className="size-4" />
            </SheetAction>
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

function SheetAction({
  label,
  destructive = false,
  onClick,
  children,
}: {
  label: string;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'v2-interactive flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium',
        'transition-colors duration-150 motion-reduce:transition-none',
        destructive
          ? 'text-destructive active:bg-destructive/10'
          : 'text-foreground active:bg-muted',
        FOCUS_RING,
      )}
    >
      {children}
      {label}
    </button>
  );
}
