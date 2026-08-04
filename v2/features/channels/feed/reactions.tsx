'use client';

import { useState } from 'react';
import { SmilePlus } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { MessageReaction } from '@/types/collab';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useEngagementThrottled } from '../engagement-throttle';
import { REACTION_TRAY } from '../model';

/**
 * reactions — the three pieces of the reaction surface: the chips under a
 * message, the curated tray that adds one, and the popover that carries the
 * tray out of the hover cluster. Phase-5 W3; sources: design-research
 * DIRECTION 5 (binding — "quiet chips, hairline border, gold on
 * `reacted_by_me`, NEVER notify"; Campfire Boosts precedent), study A4
 * (reactions BUILD NEW), api-digest §C/§F.9 — 2026-08-04.
 *
 * THE WHOLE DESIGN IN ONE SENTENCE: a reaction is a response that costs the
 * room nothing. So it is small, it is quiet, it is instant, it never rings a
 * bell anywhere, and when the server says "slower" the control simply goes
 * still (`../engagement-throttle.ts`) instead of raising an error at the one
 * person who was being friendly.
 *
 * COLOUR CARRIES EXACTLY ONE FACT — whether YOU are in this bucket. Gold ring +
 * gold tint = you reacted; hairline border on the surface = you didn't. Nothing
 * about counts, recency or popularity is encoded in colour, because none of
 * those are worth a second signal in a transcript people read for work.
 */

/** One chip. Memo-free on purpose: it is three DOM nodes, and its parent row is
 *  already inside a `memo`'d message row. */
function ReactionChip({
  reaction,
  disabled,
  onToggle,
}: {
  reaction: MessageReaction;
  disabled: boolean;
  onToggle: (emoji: string) => void;
}) {
  const mine = reaction.reacted_by_me;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(reaction.emoji)}
      aria-pressed={mine}
      aria-label={
        mine
          ? `Remove your ${reaction.emoji} reaction (${reaction.count})`
          : `React with ${reaction.emoji} (${reaction.count})`
      }
      title={disabled ? 'Reacting again in a moment…' : undefined}
      className={cn(
        'v2-interactive inline-flex min-h-6 items-center gap-1 rounded-full border px-1.5 text-xs leading-none',
        'transition-[background-color,border-color,transform] duration-150',
        'motion-reduce:transition-none active:scale-[0.96]',
        mine
          ? 'border-primary/60 bg-primary/10 text-foreground'
          : 'border-border bg-background text-muted-foreground hover:border-foreground/25 hover:bg-muted',
        // Throttled: dimmed and inert, never an error colour.
        disabled && 'pointer-events-none opacity-50',
        FOCUS_RING,
      )}
    >
      <span aria-hidden className="text-[0.8125rem] leading-none">
        {reaction.emoji}
      </span>
      <span className="tabular-nums font-medium">{reaction.count}</span>
    </button>
  );
}

/**
 * The curated tray — one row of {@link REACTION_TRAY}. Presentational and
 * shared: the hover cluster wraps it in a popover, the touch sheet drops it
 * straight in above the action list, so both input worlds offer the identical
 * set in the identical order (muscle memory survives the switch).
 */
export function ReactionTrayRow({
  reactions,
  disabled,
  size = 'default',
  onPick,
}: {
  /** Current buckets — a tray key the viewer already holds reads as pressed. */
  reactions: readonly MessageReaction[] | undefined;
  disabled: boolean;
  /** `touch` = thumb-sized keys for the bottom sheet. */
  size?: 'default' | 'touch';
  onPick: (emoji: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Add a reaction"
      className={cn('flex items-center', size === 'touch' ? 'gap-1' : 'gap-0.5')}
    >
      {REACTION_TRAY.map((emoji) => {
        const mine =
          reactions?.some((entry) => entry.emoji === emoji && entry.reacted_by_me) ??
          false;
        return (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            aria-pressed={mine}
            aria-label={mine ? `Remove ${emoji}` : `React with ${emoji}`}
            onClick={() => onPick(emoji)}
            className={cn(
              'v2-interactive inline-flex items-center justify-center rounded-full',
              'transition-[background-color,transform] duration-150 motion-reduce:transition-none',
              'hover:bg-muted active:scale-90 motion-reduce:active:scale-100',
              size === 'touch'
                ? 'size-11 text-2xl'
                : 'size-8 text-lg hover:scale-110 motion-reduce:hover:scale-100',
              mine && 'bg-primary/15',
              disabled && 'pointer-events-none opacity-50',
              FOCUS_RING,
            )}
          >
            <span aria-hidden className="leading-none">
              {emoji}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The cluster's react button + its tray popover. Self-contained open state, and
 * it closes on pick — a reaction is one gesture, not a session. Anchored to the
 * button so it never covers the message being reacted to.
 */
export function ReactionTrayPopover({
  reactions,
  onPick,
  className,
}: {
  reactions: readonly MessageReaction[] | undefined;
  onPick: (emoji: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const throttled = useEngagementThrottled('reaction');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add a reaction"
          title="Add a reaction"
          className={cn(
            'v2-interactive p-2 text-muted-foreground transition-colors duration-150',
            'hover:bg-muted hover:text-foreground motion-reduce:transition-none',
            open && 'bg-muted text-foreground',
            FOCUS_RING,
            className,
          )}
        >
          <SmilePlus aria-hidden className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={6}
        className="w-auto rounded-full p-1"
      >
        <ReactionTrayRow
          reactions={reactions}
          disabled={throttled}
          onPick={(emoji) => {
            setOpen(false);
            onPick(emoji);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The chips under a message. Renders nothing at all when there are no
 * reactions — an empty rail under every row would be exactly the per-row
 * clutter the no-list forbids.
 */
export function ReactionChips({
  reactions,
  onToggle,
}: {
  reactions: readonly MessageReaction[] | undefined;
  onToggle: (emoji: string) => void;
}) {
  const throttled = useEngagementThrottled('reaction');
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => (
        <ReactionChip
          key={reaction.emoji}
          reaction={reaction}
          disabled={throttled}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
