'use client';

import { BookText, Scale, ShieldQuestion, UserRound, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * HomePrompts — the ONE suggested-prompts surface both home designs share, so
 * their presentation can never drift (the same reason HomeComposer / HomeGreeting
 * are shared). Two presentations, one per breakpoint (owner #27):
 *
 *  - `variant="desktop"`: a ChatGPT-style quiet vertical list that sits UNDER the
 *    composer — small lucide icon + prompt text, left-aligned, no pill borders, a
 *    subtle hover tint, comfortable row height.
 *  - `variant="mobile"`: v1's stacked list (studied first-hand in
 *    `app/(main)/page.tsx`) — full-width rounded-2xl bordered rows, left-aligned
 *    text, `{prompt}…`, quiet muted colour, hover tint.
 *
 * Each instance is CSS-gated to its breakpoint by the caller, so exactly one is
 * ever visible; rendering both lets each design place them in the right spot per
 * breakpoint (mobile: above the docked composer; desktop: under the composer).
 *
 * The prompt STRINGS are v1's exact four (owner #21/#27). Clicking fills the stub
 * (without the trailing "…") into the composer and focuses the textarea — the
 * `composerAreaRef` fill-and-focus pattern already in both designs; the caller
 * passes that behaviour in as `onSelect`.
 */

interface HomePrompt {
  /** v1's exact prompt stub — inserted verbatim (the trailing "…" is display only). */
  label: string;
  /** Desktop-list leading icon (a consistent lucide set). */
  icon: LucideIcon;
}

const PROMPTS: readonly HomePrompt[] = [
  { label: 'Explain this law', icon: BookText },
  { label: 'Find a case on', icon: Scale },
  { label: 'Do I have rights to', icon: ShieldQuestion },
  { label: 'Connect me to a lawyer', icon: UserRound },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface HomePromptsProps {
  variant: 'mobile' | 'desktop';
  onSelect: (prompt: string) => void;
  className?: string;
}

export function HomePrompts({ variant, onSelect, className }: HomePromptsProps) {
  if (variant === 'mobile') {
    // v1's stacked list — full-width bordered rows, left-aligned, no icons.
    return (
      <div className={cn('flex w-full flex-col gap-2', className)}>
        {PROMPTS.map(({ label }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(label)}
            className={cn(
              'v2-interactive min-h-11 rounded-2xl border border-border px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:bg-secondary',
              FOCUS_RING,
            )}
          >
            {label}…
          </button>
        ))}
      </div>
    );
  }

  // ChatGPT-style quiet list — icon + text rows, left-aligned, no borders.
  return (
    <ul className={cn('flex flex-col', className)}>
      {PROMPTS.map(({ label, icon: Icon }) => (
        <li key={label}>
          <button
            type="button"
            onClick={() => onSelect(label)}
            className={cn(
              'group v2-interactive flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
              FOCUS_RING,
            )}
          >
            <Icon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-primary"
            />
            <span>{label}…</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
