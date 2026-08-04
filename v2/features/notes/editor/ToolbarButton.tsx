'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * ToolbarButton — the ONE formatting control, shared by the desktop bubble and
 * the touch dock bar so the two can never drift in size, state or semantics.
 *
 * ── TWO DETAILS THAT LOOK LIKE NOISE AND ARE NOT ────────────────────────────
 *  1. `onMouseDown` preventDefault. Pressing a toolbar button would otherwise
 *     move focus out of the contenteditable and COLLAPSE the selection before
 *     the click ever fires — so "select three words, press bold" would bold
 *     nothing. Suppressing the default mousedown keeps the selection intact.
 *     (The commands still `.focus()` as well, so a browser that blurs anyway
 *     recovers.)
 *  2. `aria-pressed`, not a styled-only active state. These are toggles; a
 *     screen reader has to be able to hear that bold is ON, and colour alone
 *     cannot say it.
 *
 * Sized at 36px (`size-9`) — above the 24px floor everywhere and comfortable on
 * the dock bar, where the row is the primary way to format.
 */
export function ToolbarButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onPress,
  tone = 'default',
  spin = false,
}: {
  icon: LucideIcon;
  /** The accessible name AND the native tooltip. Never an icon alone. */
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** `accent` marks a control that inserts rather than toggles (image, mention). */
  tone?: 'default' | 'accent';
  /** Turns the icon into a live spinner — for a control whose work is in flight. */
  spin?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
      className={cn(
        'v2-interactive inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
        'text-muted-foreground transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-40',
        active
          ? 'bg-secondary text-foreground'
          : 'hover:bg-secondary/70 hover:text-foreground',
        tone === 'accent' && !active && 'text-muted-foreground',
        FOCUS_RING,
      )}
    >
      <Icon
        aria-hidden
        className={cn('size-4', spin && 'motion-safe:animate-spin')}
      />
    </button>
  );
}

/** A hairline between groups of verbs. Decorative — hidden from assistive tech. */
export function ToolbarDivider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}
