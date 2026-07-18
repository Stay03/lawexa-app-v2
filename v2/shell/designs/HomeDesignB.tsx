'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  ArrowUpRight,
  BookText,
  ChevronRight,
  GraduationCap,
  MessageSquare,
  NotebookPen,
  Scale,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';
import { useMounted } from '@/v2/shell/use-mounted';
import { v2Recents } from '@/v2/shell/nav.config';

/**
 * HomeDesignB — "Research Launchpad" (the power-user candidate). The gold-shimmer
 * composer stays the primary action, but it anchors an organized command center:
 * a designed quick-start tile grid (Cases / Statutes / Notes / Quiz) and a peek at
 * recent conversations. Each breakpoint is its own composition. On MOBILE the
 * composer docks at the thumb via `position: sticky` (NOT fixed — shell-contract
 * compliant) so it is visible and reachable from first paint while the launchpad
 * scrolls behind a frosted dock. On DESKTOP it becomes a left-aligned workspace:
 * the composer sits high under the greeting, with the tiles + recents laid out
 * side by side below. The whole surface assembles with one signature — a staggered
 * fade-and-rise entrance (CSS-only, honouring `motion-reduce`). Carries
 * `data-design="b"` and the server-renderable `data-v2-marker="V2-HOME"` marker.
 */

/** Real time-of-day greeting — resolved client-side from the mount-time hour. */
function timeGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface QuickStart {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

/** The launchpad destinations — canonical clean paths (they fall through the
 * proxy to v1 for now; the intended strangler experience). */
const QUICK_START: QuickStart[] = [
  { label: 'Cases', description: 'Search and cite judgments', href: '/cases', icon: Scale },
  { label: 'Statutes', description: 'Browse Acts and sections', href: '/statutes', icon: BookText },
  { label: 'Notes', description: 'Your saved research', href: '/notes', icon: NotebookPen },
  { label: 'Quiz', description: 'Test your knowledge', href: '/quiz', icon: GraduationCap },
];

/** Suggested research prompts — clicking one loads it into the composer. */
const SUGGESTED_PROMPTS = [
  'Explain the ratio in Madukolu v Nkemdilim',
  'Consent requirements under the Land Use Act',
  'Quiz me on the Evidence Act 2011',
] as const;

/** A compact peek at recent conversations (sample data; wiring lands in phase 3). */
const RECENTS_PEEK = v2Recents.slice(0, 5);

/** Shared focus ring — unified across every interactive element. */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * The signature entrance: a soft fade + 8px rise. `fill-mode-both` holds each
 * element hidden through its stagger delay (no pre-flash); `motion-reduce` plus
 * the globals.css reduced-motion guard settle everything to its natural, fully
 * visible state instantly for users who ask for less motion.
 */
const REVEAL =
  'animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-out motion-reduce:animate-none';

export function HomeDesignB({ name }: { name?: string }) {
  const mounted = useMounted();
  const [hour] = useState(() => new Date().getHours()); // lazy initializer — lint-sanctioned
  const [input, setInput] = useState('');

  // Neutral fallback until mount resolves the real local hour; keeps the hero
  // stable (line-count reflow is still possible at hero sizes on narrow screens).
  const greeting = mounted ? timeGreeting(hour) : 'Welcome back';

  // Inert this wave — conversation wiring lands in a later phase.
  const handleSubmit = () => {};

  return (
    <div
      data-v2-marker="V2-HOME"
      data-design="b"
      className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-8 sm:px-6 md:py-12"
    >
      {/* Greeting — always first, both breakpoints. */}
      <header
        className={`${REVEAL} order-1 duration-500`}
        style={{ animationDelay: '0ms' }}
      >
        <h1 className="font-comfortaa text-[30px] font-semibold leading-tight text-foreground md:text-[44px]">
          {greeting}
          {name ? (
            <>
              , <span className="text-primary">{name}</span>
            </>
          ) : null}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Start something new, or pick up a thread.
        </p>
      </header>

      {/* Launchpad — mobile: stacked above the composer. Desktop: below it, with
          the quick-start grid and recents peek side by side. */}
      <section
        aria-label="Launchpad"
        className="order-2 mt-8 md:order-4 md:mt-10 lg:grid lg:grid-cols-3 lg:gap-6"
      >
        {/* Quick start */}
        <div className="lg:col-span-2">
          <h2
            className={`${REVEAL} mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground duration-500`}
            style={{ animationDelay: '180ms' }}
          >
            Jump in
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            {QUICK_START.map((tile, i) => {
              const Icon = tile.icon;
              return (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className={`${REVEAL} ${FOCUS_RING} group relative flex min-h-[6.5rem] flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors duration-300 hover:border-primary/40 hover:bg-secondary/50`}
                  style={{ animationDelay: `${220 + i * 55}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <span
                      aria-hidden
                      className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15"
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <ArrowUpRight
                      aria-hidden
                      className="size-4 text-muted-foreground/40 transition-colors group-hover:text-primary"
                    />
                  </div>
                  <div className="mt-3">
                    <div className="text-[15px] font-medium text-foreground">{tile.label}</div>
                    <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                      {tile.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recents peek — a read-only preview; "All" opens the full list. Rows are
            intentionally non-interactive this wave (real wiring lands in phase 3),
            so they read as content, not as buttons that do nothing on tap. */}
        <section
          aria-label="Recent conversations"
          className={`${REVEAL} mt-8 rounded-xl border border-border bg-card p-2 duration-500 sm:p-3 lg:col-span-1 lg:mt-0`}
          style={{ animationDelay: '300ms' }}
        >
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent
            </h2>
            <Link
              href="/conversations"
              className={`${FOCUS_RING} inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground`}
            >
              All
              <ChevronRight aria-hidden className="size-3.5" />
            </Link>
          </div>
          <ul className="flex flex-col">
            {RECENTS_PEEK.map((recent) => (
              <li
                key={recent.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5"
              >
                <MessageSquare
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground/60"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground/90">
                  {recent.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </section>

      {/* Suggested prompts — in the scrollable flow above the composer. On mobile
          `mt-auto` sinks this group toward the thumb; on tall content it scrolls
          in above the docked composer. */}
      <div
        className={`${REVEAL} order-3 mt-auto flex flex-wrap gap-2 pt-8 duration-500 md:mt-4 md:max-w-2xl md:pt-0`}
        style={{ animationDelay: '150ms' }}
      >
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setInput(prompt)}
            className={`${FOCUS_RING} inline-flex min-h-11 items-center rounded-full border border-border bg-transparent px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground active:bg-secondary`}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Composer dock — the primary action. MOBILE: `sticky bottom-0` pins it to
          the thumb from first paint (frosted, full-bleed) while the launchpad
          scrolls behind. DESKTOP: static, high under the greeting. The entrance
          transform lives on the inner wrapper so it never touches the sticky
          element itself. */}
      <div className="order-4 sticky bottom-0 z-10 -mx-4 border-t border-border/60 bg-background/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6 md:static md:order-2 md:z-auto md:mx-0 md:mt-6 md:max-w-2xl md:border-t-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none">
        <div className={`${REVEAL} duration-500`} style={{ animationDelay: '90ms' }}>
          <PromptInput value={input} onValueChange={setInput} onSubmit={handleSubmit}>
            <PromptInputTextarea
              placeholder="Ask anything about Nigerian law"
              className="text-foreground"
            />
            <PromptInputActions className="flex items-center justify-end gap-2 px-3 pb-3">
              <PromptInputAction tooltip="Send message">
                <Button
                  type="button"
                  size="icon"
                  className="size-11 rounded-full bg-primary hover:bg-primary/90 md:size-8"
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  aria-label="Send message"
                >
                  <ArrowUp className="size-5" />
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
