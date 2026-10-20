'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
 * the dock bar, where the row is the primary way to format. `compact` is the
 * computer bar's 32px (`size-8`), a pointer's size, which keeps that bar on one
 * row (`DesktopToolbar.tsx`).
 */
export function ToolbarButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onPress,
  tone = 'default',
  spin = false,
  shortcut,
  compact = false,
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
  /**
   * The key binding as the reader's keyboard writes it ("⌘B", "Ctrl+B"). With
   * it, the button shows a tooltip with the name and the keys in place of the
   * native title (Arthur's editor step 1). The touch bar passes none: a phone
   * has no hover and no shortcuts.
   */
  shortcut?: string;
  /** The computer bar's 32px size. */
  compact?: boolean;
}) {
  const button = (
    <button
      type="button"
      title={shortcut ? undefined : label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
      className={cn(
        'v2-interactive inline-flex shrink-0 items-center justify-center rounded-lg',
        compact ? 'size-8' : 'size-9',
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

  if (!shortcut) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        <span>{label}</span>
        <kbd className="ml-2 font-sans text-[11px] opacity-70">{shortcut}</kbd>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The computer bar's menu buttons (alignment, table, More): a 32px icon button
 * like a compact `ToolbarButton`, lit while its menu is open.
 */
export const DESKTOP_MENU_TRIGGER = cn(
  'v2-interactive inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground',
  'transition-colors duration-150 hover:bg-secondary/70 hover:text-foreground',
  'disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-secondary data-[state=open]:text-foreground',
);

/** A hairline between groups of verbs. Decorative — hidden from assistive tech. */
export function ToolbarDivider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}
