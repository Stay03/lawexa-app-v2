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
  TextSelect,
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
 *
 * SELECT TEXT IS THE SECOND TOUCH-ONLY ACTION, and it is the missing half of
 * that same trade (@arthur, Aug 7). "Whole rather than partial" was the honest
 * description of a compromise, not a principle: he wanted one sentence out of a
 * message and could only take all of it. The two verbs are siblings and sit
 * together — Copy text ends the job in one tap when the whole message is what
 * you wanted, Select text gives this one row back to the platform so a finger
 * can draw the part that is. Neither is gated by a media query, for the same
 * reason Copy text never was: THIS SHEET only ever opens from a touch long
 * press, so a mouse — which never lost drag-select — never sees either.
 *
 * BOTH ARE WITHHELD FROM A MESSAGE MADE ONLY OF FILES. `content` is `""` there
 * (backend, 2026-08-05): one verb would copy an empty string and say "Copied"
 * about it, the other would select nothing and look broken.
 *
 * "SELECT TEXT" IS ANNOUNCED LIKE EVERY OTHER ROW, and that is a decision, not
 * an oversight. It is tempting to hide it from assistive tech — a screen reader
 * carries its own text cursor and its own copy, and the highlight this paints is
 * a purely visual affordance — but that argument would hide a control that is
 * plainly ON SCREEN, which is the one thing `aria-hidden` must never do (it
 * would also have to be pulled from the sheet's focus trap to stay legal). A
 * reader running VoiceOver or TalkBack on a phone they can also see would find a
 * row they can touch and cannot reach. It stays, plainly named, its hint inside
 * its own accessible name, next to the Copy text that will usually serve them
 * better.
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
  onSelectText,
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
  /** Hand this one message's words back to the platform's own selection —
   *  see the docblock, and `use-text-select-mode.ts` for the mechanics. */
  onSelectText: (message: Message) => void;
}) {
  const open = message !== null;
  const reactionThrottled = useEngagementThrottled('reaction');
  const saveThrottled = useEngagementThrottled('bookmark');
  const pinned = message?.is_pinned === true;
  const saved = message?.is_bookmarked === true;
  const sessionUuid =
    message?.is_ai === true ? (message.metadata.session_uuid ?? null) : null;
  /** True for exactly one close: the one "Select text" asked for. A ref rather
   *  than state because nothing renders differently — it is read once, by the
   *  focus handler below, on the way out. */
  const keepSelectionRef = useRef(false);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="bottom"
        className="v2-safe-bottom rounded-t-2xl"
        // EVERY OTHER VERB WANTS ITS FOCUS BACK; THIS ONE MUST NOT TAKE IT.
        // Radix returns focus to whatever held it when the sheet opened, which
        // on a phone can be the composer — and a textarea taking focus takes
        // the document selection with it and, on iOS, the keyboard comes up
        // over the message the reader asked to read. So the restore is
        // suppressed for that one close and left alone for all the others.
        onCloseAutoFocus={(event) => {
          if (!keepSelectionRef.current) return;
          keepSelectionRef.current = false;
          event.preventDefault();
        }}
      >
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
              <>
                <CopyTextAction
                  key={message.uuid}
                  content={message.content}
                  onDone={onClose}
                />
                {/* THE SELECTION IS MADE FIRST, AND THE SHEET LEAVES AFTER IT.
                    Closing first would push the work into a timer chasing the
                    sheet's 200ms exit; this way it is one straight line, and
                    the reader watches the sheet slide off a message that is
                    already highlighted. Radix's modal environment does not
                    interfere — measured, see `use-text-select-mode.ts`.

                    THE SECOND LINE IS NOT DECORATION. No browser will raise the
                    drag handles for a selection made by script — Blink clears
                    the flag on every Selection API call, and on iOS the handles
                    belong to a UIKit interaction JavaScript cannot activate — so
                    the highlight this action paints is the whole message and the
                    reader narrows it with the platform's own gesture. That
                    gesture is a touch-and-hold, which is also the gesture that
                    opened this sheet, so it has to be said out loud once. It is
                    said HERE, at the moment of choosing, rather than as a line
                    of chrome in the transcript that would then need its own way
                    of going away. */}
                <SheetAction
                  label="Select text"
                  hint="Touch and hold to adjust"
                  onClick={() => {
                    keepSelectionRef.current = true;
                    onSelectText(message);
                    onClose();
                  }}
                >
                  <TextSelect aria-hidden className="size-4" />
                </SheetAction>
              </>
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
      // conversation and case copy affordances take. Nothing to surface: a
      // pointer-fine reader can still drag across the text, and since Aug 7 a
      // touch reader has Select text one row below, which reaches the
      // platform's own Copy rather than this API.
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
 *  the two toggles — same rule as the desktop cluster's `RowAction`.
 *
 *  `hint` is the exception the list earns rather than the shape it takes. Every
 *  other row is a verb that finishes when you press it and needs no explaining;
 *  Select text hands the message to a gesture, and the gesture has to be named.
 *  It rides INSIDE the button rather than beside it, so the sentence is part of
 *  the row's accessible name and a screen reader hears the whole offer. */
function SheetAction({
  label,
  hint,
  destructive = false,
  pressed,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  hint?: string;
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
        'v2-interactive flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm font-medium',
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
      {hint === undefined ? (
        label
      ) : (
        <span className="flex min-w-0 flex-col">
          <span>{label}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        </span>
      )}
    </button>
  );
}
