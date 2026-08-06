'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  CornerUpLeft,
  Pencil,
  Pin,
  PinOff,
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
import { LawexaMark } from '../ui/avatars';

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
 * gesture out. The verbs below it hold the desktop cluster's order, so the two
 * input worlds agree about where a SHARED action lives.
 *
 * COPY TEXT IS THE ONE ACTION THAT IS TOUCH-ONLY, and it is not a nicety
 * (owner round, Aug 4). `.v2-touch-hold` suppresses the callout and — on coarse
 * pointers — the selection itself, so a finger can no longer drag across a
 * message to copy part of it; this hands that back at the top of the list,
 * whole rather than partial, which is the trade every messaging app makes.
 * A fine pointer never lost drag-to-copy, so the desktop cluster does NOT get a
 * matching glyph: adding a seventh grey square to buy back something the mouse
 * already does would cost the row more than it gained.
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

            {/* Keyed by uuid so the "Copied" confirmation can never survive
                into the next message's sheet — the sheet itself is one per feed
                and stays mounted.

                A MESSAGE MADE ONLY OF FILES HAS NOTHING TO COPY. Its `content`
                is `""` (backend, 2026-08-05), and the verb would put an empty
                string on the clipboard and then say "Copied" about it. The row
                is simply absent instead — the file itself is reached by opening
                it, not by copying the message. */}
            {message.content.trim() !== '' && (
              <CopyTextAction key={message.uuid} content={message.content} onDone={onClose} />
            )}
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
                <LawexaMark />
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

/** How long "Copied" stays on screen before the sheet dismisses itself. Long
 *  enough to read, short enough that it never feels like a stuck sheet. */
const COPIED_HOLD_MS = 700;

/**
 * Copy the message's RAW `content` — never the rendered text. A Lawexa answer
 * is markdown, and pasting it into a note or a document should arrive as
 * markdown, not as prose with its headings and lists flattened out.
 *
 * Its own component so the confirmation state lives on one row instead of
 * re-rendering the whole sheet, and so the call site's `key` can reset it.
 */
function CopyTextAction({
  content,
  onDone,
}: {
  content: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Clipboard refused (insecure context, or permission denied). Close
      // without claiming a copy that did not happen — the same silent path the
      // conversation and case copy affordances take. Nothing to surface: the
      // reader can still select the text on a pointer-fine device.
      onDone();
      return;
    }
    setCopied(true);
    timerRef.current = setTimeout(onDone, COPIED_HOLD_MS);
  };

  return (
    <SheetAction
      label={copied ? 'Copied' : 'Copy text'}
      // NOT `disabled` while confirming: the sheet's disabled style is a 50%
      // dim, and dimming the confirmation is the opposite of confirming it.
      onClick={() => {
        if (!copied) void copy();
      }}
    >
      {copied ? (
        <Check aria-hidden className="size-4 text-primary" />
      ) : (
        <Copy aria-hidden className="size-4" />
      )}
    </SheetAction>
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
