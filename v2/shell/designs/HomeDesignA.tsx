'use client';

import { useState } from 'react';
import { ArrowUp, GraduationCap, Landmark, NotebookPen, Scale } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';
import { cn } from '@/lib/utils';
import { useMounted } from '@/v2/shell/use-mounted';

/**
 * Suggested research prompts. Clicking one populates the composer (local state)
 * rather than navigating — they are compose helpers, not links. Each is written
 * to read equally well as the chip label and as the text it drops into the box.
 * The fourth is desktop-only so the mobile strip stays a single quiet line.
 */
const SUGGESTED_PROMPTS = [
  'Explain the ratio in Madukolu v Nkemdilim',
  'Consent under the Land Use Act, state by state',
  'Quiz me on the Evidence Act 2011',
  'Fair hearing under s.36 of the 1999 Constitution',
] as const;

/**
 * Quiet quick-jump navigation. Clean canonical paths that fall through the v2
 * proxy to the v1 screens (correct until those routes are migrated), so these
 * are real full-page `<a>` navigations — not client-side router links.
 */
const QUICK_ACTIONS = [
  { href: '/cases', label: 'Cases', Icon: Scale },
  { href: '/statutes', label: 'Statutes', Icon: Landmark },
  { href: '/notes', label: 'Notes', Icon: NotebookPen },
  { href: '/quiz', label: 'Quiz', Icon: GraduationCap },
] as const;

/**
 * Real time-of-day greeting. Pure — the hour is threaded in from a lazy,
 * lint-sanctioned `useState` initializer so `new Date()` never runs in render.
 * Every branch returns a two-word string (as does the pre-mount fallback), which
 * minimizes — but does not fully prevent — hydration reflow: at the hero sizes,
 * with `text-balance`, a very narrow screen can reflow by one line for a single
 * frame on mount. That one-frame swap is accepted (dev-tool-grade flash); no
 * fixed height is reserved, so the hero keeps its full breathing room.
 */
function timeGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * HomeDesignA — "Warm Spotlight". The shimmer composer is the lit centerpiece:
 * a soft radial gold wash (built only from the --primary token at low opacity)
 * pools behind it, a large Comfortaa time-of-day greeting sits above, and
 * everything else — ghost prompt chips, a quiet quick-jump row — recedes into
 * generous negative space.
 *
 * Mobile is thumb-first: the greeting and quick-jump ride the top while the
 * compose cluster (chips directly over the composer) is pushed to the bottom via
 * `mt-auto`, landing the input in the thumb zone. Desktop recomposes the same
 * DOM into a vertically-centered hero.
 *
 * Carries `data-design="a"` for the switch and the server-renderable
 * `data-v2-marker="V2-HOME"` the curl verification matrix greps for. Complete
 * and beautiful without `name` (guests), which is threaded in when present.
 */
export function HomeDesignA({ name }: { name?: string }) {
  const [input, setInput] = useState('');

  // Hydration-safe greeting: `useMounted` is false on the server and the first
  // client render (neutral fallback), true once mounted. The hour is read once
  // via a lazy initializer so the React Compiler lint never sees `new Date()` in
  // the render body. The fallback is the same two-word shape, which minimizes
  // (does not guarantee) a one-frame reflow on mount — see `timeGreeting`.
  const mounted = useMounted();
  const [hour] = useState(() => new Date().getHours());
  const greeting = mounted ? timeGreeting(hour) : 'Welcome back';

  // Inert this wave — real conversation wiring lands in a later phase.
  const handleSubmit = () => {};

  return (
    <div
      data-v2-marker="V2-HOME"
      data-design="a"
      className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col overflow-hidden px-4 pt-10 pb-8 md:justify-center md:py-16"
    >
      {/* Ambient warm spotlight — decorative, aria-hidden, built only from the
          --primary token at low opacity. Two layered radials (a wide static wash
          and a slower breathing core) give the light depth; the breathe is a
          whisper and is dropped entirely under reduced-motion. Positioned low on
          mobile (behind the docked composer) and mid on desktop (behind the
          centered hero). Sits under everything and never touches text contrast. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute top-[70%] left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.06] blur-[120px] md:top-[54%] dark:bg-primary/[0.12]" />
        <div
          className="absolute top-[72%] left-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.12] blur-[90px] motion-safe:animate-pulse md:top-[56%] dark:bg-primary/20"
          // Slow the shared `pulse` keyframe to an ambient breathe (default is a
          // notification-fast 2s). Inert under reduced-motion, where the
          // motion-safe guard removes the animation entirely.
          style={{ animationDuration: '7s' }}
        />
      </div>

      {/* Greeting — the ONLY place gold text appears. It is large display type,
          where the token clears WCAG AA (3:1 large) in both themes; body-sized
          gold on light does not, so it lives nowhere else. Comfortaa for the
          greeting; the supporting line stays system sans for typographic
          contrast between rounded display and crisp utility text. */}
      <header className="text-center">
        <h1 className="font-comfortaa text-[2rem] font-semibold tracking-tight text-balance text-foreground sm:text-[2.5rem] md:text-[3.25rem]">
          {greeting}
          {name ? (
            <>
              {', '}
              <span className="text-primary">{name}</span>
            </>
          ) : null}
          .
        </h1>
        <p className="mt-3 text-base text-muted-foreground md:text-lg">
          What are we researching?
        </p>
      </header>

      {/* Quiet quick-jump nav — subordinate to the composer, muted until hovered.
          Real `<a>` links to canonical paths (proxied to v1 for now). */}
      <nav
        aria-label="Quick links"
        className="mt-6 flex flex-wrap items-center justify-center gap-1.5 md:mt-8 md:gap-2"
      >
        {QUICK_ACTIONS.map(({ href, label, Icon }) => (
          <a
            key={href}
            href={href}
            className="v2-interactive inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none md:min-h-9"
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </a>
        ))}
      </nav>

      {/* Compose cluster — pushed to the bottom on mobile (thumb-first) via
          `mt-auto`, and folded into the centered hero on desktop (`md:mt-12`).
          The chips sit directly above the composer they fill. */}
      <div className="mt-auto md:mt-12">
        {/* Ghost prompt chips. Mobile: an edge-to-edge single-line strip that
            scrolls (scrollbar hidden) so it never adds vertical bulk under the
            composer. Desktop: a centered wrap. They whisper — quiet border, muted
            text — until hovered. */}
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:mx-0 md:flex-wrap md:justify-center md:overflow-visible md:px-0 md:py-0 [&::-webkit-scrollbar]:hidden">
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setInput(prompt)}
              className={cn(
                'v2-interactive inline-flex min-h-11 shrink-0 items-center rounded-full border border-border/60 px-4 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground active:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none md:min-h-9',
                i === 3 && 'hidden md:inline-flex',
              )}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* The shimmer composer — my own composition of the shared PromptInput
            primitives, so the ORIGINAL animated gold-shimmer border comes free
            from the default variant. Enlarged and lifted off the glow with a soft
            shadow; typed text is `text-foreground` (readable) rather than the
            primitive's gold default. Submit is inert this wave. */}
        <PromptInput
          value={input}
          onValueChange={setInput}
          onSubmit={handleSubmit}
          className="p-2.5 shadow-lg"
        >
          <PromptInputTextarea
            placeholder="Ask anything about Nigerian law"
            className="min-h-[56px] text-base text-foreground placeholder:text-muted-foreground md:text-lg"
          />
          <PromptInputActions className="flex items-center justify-end px-2 pb-1">
            <PromptInputAction tooltip="Send message">
              <Button
                type="button"
                size="icon"
                className="v2-interactive size-11 rounded-full bg-primary hover:bg-primary/90 md:size-10"
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
  );
}
