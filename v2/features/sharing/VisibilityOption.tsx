'use client';

import { Check, Loader2, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * One choice of "who can see this": a radar report and a chat both offer
 * Private and Public. Two of these side by side, NOT a fake radiogroup:
 * announcing radios without arrow-key roving would promise keyboarding the
 * control does not have. `aria-pressed` says exactly what these are.
 *
 * Moved here from the radar's share dialog on 25 September 2026, when chats
 * gained the same choice, so the two cannot drift apart.
 */
export function VisibilityOption({
  icon: Icon,
  title,
  description,
  selected,
  busy,
  disabled = false,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  busy: boolean;
  /** A choice the reader may see but not take (a quiz's "Everyone" for an
   *  author the server has not verified). Drawn, dimmed, with its reason in
   *  `description`; a hidden choice would leave them wondering why. */
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      disabled={busy || disabled}
      className={cn(
        'v2-interactive flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:bg-muted/50',
        disabled && 'opacity-60 hover:bg-transparent',
      )}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"
      >
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="block text-sm text-muted-foreground">
          {description}
        </span>
      </span>
      {selected ? (
        <Check aria-hidden className="size-5 shrink-0 text-primary" />
      ) : busy ? (
        <Loader2
          aria-hidden
          className="size-5 shrink-0 animate-spin text-muted-foreground"
        />
      ) : null}
    </button>
  );
}
