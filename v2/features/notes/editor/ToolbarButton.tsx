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
 * row (`DesktopToolbar.tsx`). `pill` is the draft panel's floating bar (take
 * B, Stay 24 October 2026): 30px, no fill at rest, a soft one on hover
 * (foreground at 6%, white at 7% in dark) and a firmer one while on.
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
  pill = false,
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
  /** The draft panel's floating bar: 30px with soft fills. Has a tooltip, as `compact`. */
  pill?: boolean;
}) {
  // Every button on the computer bar names itself in a tooltip, with or without
  // keys (Tester, 20 October 2026: Link, Image and @case showed only the slow
  // native title). A disabled one is `aria-disabled` rather than `disabled`, so
  // the pointer still reaches it and a greyed Redo still says what it is.
  const tooltip = compact || pill || shortcut !== undefined;
  const button = (
    <button
      type="button"
      title={tooltip ? undefined : label}
      aria-label={label}
      aria-pressed={active}
      disabled={tooltip ? undefined : disabled}
      aria-disabled={tooltip && disabled ? true : undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={disabled ? undefined : onPress}
      className={cn(
        'v2-interactive inline-flex shrink-0 items-center justify-center rounded-lg',
        pill ? 'size-7.5' : compact ? 'size-8' : 'size-9',
        pill ? 'text-foreground/62' : 'text-muted-foreground',
        'transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40',
        disabled
          ? null
          : pill
            ? active
              ? 'bg-foreground/9 text-foreground dark:bg-white/11'
              : 'hover:bg-foreground/6 hover:text-foreground dark:hover:bg-white/7'
            : active
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

  if (!tooltip) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        <span>{label}</span>
        {shortcut ? <kbd className="ml-2 font-sans text-[11px] opacity-70">{shortcut}</kbd> : null}
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

/**
 * The draft panel's floating bar's menu buttons and dropdown triggers: 30px
 * high, no fill at rest, the bar's soft hover, lit while the menu is open.
 * Width is the caller's (`size-7.5` for an icon, padding for a label).
 */
export const PILL_TRIGGER = cn(
  'v2-interactive inline-flex h-7.5 shrink-0 items-center justify-center rounded-lg text-foreground/62',
  'transition-colors duration-150 hover:bg-foreground/6 hover:text-foreground dark:hover:bg-white/7',
  'disabled:pointer-events-none disabled:opacity-40',
  'data-[state=open]:bg-foreground/9 data-[state=open]:text-foreground dark:data-[state=open]:bg-white/11',
);

/** A small dot between the floating bar's groups. Decorative, as the divider. */
export function ToolbarDot() {
  return <span aria-hidden className="mx-1.25 size-0.75 shrink-0 rounded-full bg-foreground/22" />;
}

/** A hairline between groups of verbs. Decorative — hidden from assistive tech. */
export function ToolbarDivider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}
