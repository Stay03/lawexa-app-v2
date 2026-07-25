'use client';

import {
  BookText,
  ClipboardList,
  FileSearch,
  GraduationCap,
  Handshake,
  ListChecks,
  Scale,
  ShieldQuestion,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { HomeTab } from '@/v2/shell/home-tabs';

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
 * ── ONE SET PER TAB (owner, July 25) ───────────────────────────────────────
 * All three tabs used to show the same four legal prompts, so neither Work nor
 * Study felt like its own place — the tab changed the modules underneath and left
 * the most prominent, most-read content on the page identical. Each tab now has its
 * own four, written for what that tab is FOR:
 *
 *  • chat  — v1's exact four (owner #21/#27), unchanged. This is the general
 *            legal-question surface and its prompts were already right.
 *  • work  — practice work: a matter, a document, a deadline, a counterparty.
 *  • study — learning: understand, compare, test yourself, revise.
 *
 * Clicking fills the stub (without the trailing "…") into the composer and focuses
 * the textarea — the `composerAreaRef` fill-and-focus pattern already in the
 * surfaces; the caller passes that behaviour in as `onSelect`.
 */

interface HomePrompt {
  /** v1's exact prompt stub — inserted verbatim (the trailing "…" is display only). */
  label: string;
  /** Desktop-list leading icon (a consistent lucide set). */
  icon: LucideIcon;
}

const PROMPTS_BY_TAB: Record<HomeTab, readonly HomePrompt[]> = {
  // v1's exact four — the general legal-question surface, unchanged.
  chat: [
    { label: 'Explain this law', icon: BookText },
    { label: 'Find a case on', icon: Scale },
    { label: 'Do I have rights to', icon: ShieldQuestion },
    { label: 'Connect me to a lawyer', icon: UserRound },
  ],
  // Practice work — the things a matter actually needs done.
  work: [
    { label: 'Draft a clause for', icon: ClipboardList },
    { label: 'Review this agreement for', icon: FileSearch },
    { label: 'What are the filing steps for', icon: ListChecks },
    { label: 'Prepare talking points on', icon: Handshake },
  ],
  // Learning — understand it, compare it, test yourself on it.
  study: [
    { label: 'Explain in simple terms', icon: GraduationCap },
    { label: 'Summarise the leading case on', icon: BookText },
    { label: 'Compare these two doctrines', icon: Scale },
    { label: 'Quiz me on', icon: Sparkles },
  ],
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface HomePromptsProps {
  variant: 'mobile' | 'desktop';
  /** Which tab's set to show. Defaults to `chat` so the inert route fallback and
   *  any future caller get the general set without having to think about it. */
  tab?: HomeTab;
  onSelect: (prompt: string) => void;
  className?: string;
}

export function HomePrompts({
  variant,
  tab = 'chat',
  onSelect,
  className,
}: HomePromptsProps) {
  const PROMPTS = PROMPTS_BY_TAB[tab];

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
