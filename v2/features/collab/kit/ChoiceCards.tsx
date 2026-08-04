'use client';

import { useId } from 'react';
import { Check, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * ChoiceCards — the radio-card primitive for a product FORK: Work vs Study,
 * Personal vs Organization, Public vs Private. Every one of those is a
 * decision whose consequence the reader must see BEFORE choosing, and every
 * one of them currently hides inside a `Select` whose options are a word each.
 *
 * ── REAL RADIOS, NOT ARIA ──────────────────────────────────────────────────
 * Each card is a `<label>` WRAPPING a visually-hidden native
 * `<input type="radio">`, inside a `<fieldset>` with a real `<legend>` — the
 * `SchedulePicker` precedent, and the reason it is the right one: the platform
 * already implements the whole APG radio contract. One tab stop for the group,
 * arrow keys that move and select with wrap-around, the group name announced
 * with the option's position, form participation and reset. A hand-rolled
 * `role="radiogroup"` with a roving tabindex re-implements every line of that
 * and can only be less correct. (Home/End are NOT part of the APG radio
 * pattern and only Firefox binds them — the arrows are the contract.)
 *
 * Wrapping (rather than `htmlFor`-pairing) is what makes the radio's
 * accessible name the card's FULL text — title and consequence together — so
 * a screen-reader user hears the same thing a sighted one reads, instead of
 * two words.
 *
 * ── SELECTION IS NOT CARRIED BY COLOUR ─────────────────────────────────────
 * The checked card gains a filled check mark, a stronger border and a tinted
 * ground: three signals, two of which survive a monochrome render. State is
 * read off the input with `:has()` rather than the sibling `peer` variant,
 * because the parts that must respond (the glyph, the check) are DESCENDANTS
 * of the label and a sibling combinator cannot reach them.
 *
 * No skeleton ships with this: a fork is form chrome, rendered only once its
 * dialog is open with its fields ready. It is never a region awaiting a fetch.
 */

export interface Choice<Value extends string> {
  value: Value;
  icon: LucideIcon;
  title: string;
  /** ONE sentence naming what choosing this does — not a longer title. */
  description: string;
  disabled?: boolean;
}

export function ChoiceCards<Value extends string>({
  legend,
  legendHidden = false,
  choices,
  value,
  onChange,
  columns = 2,
  className,
}: {
  /** The question. Rendered as the fieldset's legend. */
  legend: string;
  /** Hides the legend visually but keeps it as the group's accessible name. */
  legendHidden?: boolean;
  choices: readonly Choice<Value>[];
  value: Value;
  onChange: (next: Value) => void;
  columns?: 1 | 2;
  className?: string;
}) {
  // Scopes the radio `name` to this instance, so two forks in one dialog
  // cannot merge into one group and cancel each other out.
  const groupName = useId();

  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend
        className={cn(
          'text-sm font-medium text-foreground',
          legendHidden ? 'sr-only' : 'mb-2',
        )}
      >
        {legend}
      </legend>

      <div
        className={cn('grid gap-2', columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1')}
      >
        {choices.map((choice) => {
          const Icon = choice.icon;
          return (
            <label
              key={choice.value}
              className={cn(
                'group v2-interactive relative flex h-full cursor-pointer flex-col gap-1 rounded-xl border border-border bg-background p-3 pr-9',
                'transition-colors duration-150 motion-reduce:transition-none',
                'hover:bg-secondary/40',
                'has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5',
                'has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
                'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:disabled]:hover:bg-background',
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={choice.value}
                checked={value === choice.value}
                disabled={choice.disabled}
                onChange={() => onChange(choice.value)}
                className="sr-only"
              />

              <span className="flex min-w-0 items-center gap-2">
                <Icon
                  aria-hidden
                  className="size-[18px] shrink-0 text-muted-foreground transition-colors duration-150 group-has-[:checked]:text-primary motion-reduce:transition-none"
                />
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {choice.title}
                </span>
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {choice.description}
              </span>

              <span
                aria-hidden
                className={cn(
                  'absolute right-3 top-3 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground',
                  'scale-75 opacity-0 transition-[opacity,transform] duration-150 motion-reduce:transition-none',
                  'group-has-[:checked]:scale-100 group-has-[:checked]:opacity-100',
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
