'use client';

import { useState } from 'react';
import { GraduationCap, Landmark, NotebookPen, Scale } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getSmartGreetingParts } from '@/lib/constants/greetings';
import { PulsingHeart } from '@/components/ui/pulsing-heart';
import { useMounted } from '@/v2/shell/use-mounted';
import { HomeComposer } from './HomeComposer';

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
 * HomeDesignA — "Warm Spotlight". The shimmer composer is the lit centerpiece:
 * a soft radial gold wash (built only from the --primary token at low opacity)
 * pools behind it, a Comfortaa greeting sits above (capped at v1's ~36px), and
 * everything else — ghost prompt chips, a quiet quick-jump row — recedes into
 * generous negative space.
 *
 * Mobile is thumb-first: the greeting and quick-jump ride the top while the
 * compose cluster (chips directly over the composer) is pushed to the bottom via
 * `mt-auto`, landing the input in the thumb zone. Desktop recomposes the same
 * DOM into a vertically-centered hero.
 *
 * The greeting is v1's REAL smart engine (`getSmartGreetingParts`): a randomized
 * holiday/day/time greeting that differs per refresh, with probabilistic name
 * inclusion and the '__PULSING_HEART__' special. It renders v1's 'Welcome'
 * fallback pre-mount (server + first client render), then the real greeting once
 * mounted — the lint-sanctioned `useMounted` + lazy `useState(initializer)` pair,
 * so the engine's `Math.random`/`Date` never run in the render body.
 *
 * Carries `data-design="a"` for the switch and the server-renderable
 * `data-v2-marker="V2-HOME"` the curl verification matrix greps for. Complete and
 * beautiful without `name` (guests), which is threaded in when present.
 */
export function HomeDesignA({
  name,
  signedIn = false,
}: {
  name?: string;
  signedIn?: boolean;
}) {
  const [input, setInput] = useState('');

  // v1's smart greeting, resolved once via a lazy initializer (engine internals
  // use Math.random/Date, which must not run in render). `useMounted` holds the
  // neutral 'Welcome' fallback on the server + first client render, then reveals
  // the real greeting — no hydration mismatch.
  const mounted = useMounted();
  const [parts] = useState(() => getSmartGreetingParts(name));
  const greeting = mounted ? parts.greeting : 'Welcome';
  const greetingName = mounted ? parts.name : '';
  const isSpecial = mounted ? parts.isSpecial : null;

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
          greeting; capped at v1's ~36px desktop scale. */}
      <header className="text-center">
        <h1 className="font-comfortaa text-[1.75rem] font-semibold tracking-tight text-balance text-foreground sm:text-[2rem] md:text-[2.25rem]">
          {isSpecial === '__PULSING_HEART__' ? (
            <PulsingHeart />
          ) : (
            <>
              {greeting}
              {greetingName ? (
                <>
                  {', '}
                  <span className="text-primary">{greetingName}</span>
                </>
              ) : null}
            </>
          )}
        </h1>
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

        {/* The shared v2-native composer — the ORIGINAL animated gold-shimmer
            border comes free from the default PromptInput variant. Enlarged and
            lifted off the glow with a soft shadow; single-line initial height
            (auto-grow), the full furniture (plus-menu, workflow, jurisdiction).
            Submit is inert this wave. */}
        <HomeComposer
          value={input}
          onValueChange={setInput}
          signedIn={signedIn}
          className="p-2.5 shadow-lg"
          textareaClassName="text-base md:text-lg"
          sendButtonClassName="md:size-10"
        />
      </div>
    </div>
  );
}
