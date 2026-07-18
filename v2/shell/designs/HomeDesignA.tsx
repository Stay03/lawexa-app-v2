'use client';

import { useRef, useState } from 'react';
import { GraduationCap, Landmark, NotebookPen, Scale } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/auth';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';

/**
 * HomeDesignA — "Warm Spotlight". The shimmer composer is the lit centerpiece:
 * a soft radial gold wash (built only from the --primary token at low opacity)
 * pools behind it, a Comfortaa greeting sits above (capped at v1's ~36px), and
 * everything else — ghost prompt chips, a quiet quick-jump row — recedes into
 * generous negative space.
 *
 * Mobile is thumb-first: the greeting rides the top, the mobile-only quick-jump
 * row sits under it, and the compose cluster (chips over the composer) is pushed
 * to the bottom via `mt-auto`, landing the input in the thumb zone. DESKTOP hides
 * the quick-jump row entirely (owner #20: the sidebar already provides those
 * shortcuts) and recomposes the same DOM into a vertically-centered hero.
 *
 * The greeting (`HomeGreeting`) is v1's REAL smart engine with the skeleton-first
 * reveal and the confidential-mode heading swap. Confidential is owned here so the
 * greeting and composer stay in lockstep. Suggested prompts are v1's ACTUAL four
 * (owner #21), shown with the trailing "…" exactly as v1 renders them.
 *
 * Carries `data-design="a"` for the switch and the server-renderable
 * `data-v2-marker="V2-HOME"` marker the curl matrix greps for. Complete without
 * `name` (guests), which is threaded in when present.
 */

/** v1's ACTUAL suggested prompts (`app/(main)/page.tsx`) — short stubs shown with
 *  a trailing "…"; clicking drops the stub (without the "…") into the composer.
 *  v1 has no rotation/randomization, so neither does this. */
const SUGGESTED_PROMPTS = [
  'Explain this law',
  'Find a case on',
  'Do I have rights to',
  'Connect me to a lawyer',
] as const;

/**
 * Quiet quick-jump navigation (MOBILE ONLY). Clean canonical paths that fall
 * through the v2 proxy to the v1 screens, so these are real full-page `<a>`
 * navigations — not client-side router links.
 */
const QUICK_ACTIONS = [
  { href: '/cases', label: 'Cases', Icon: Scale },
  { href: '/statutes', label: 'Statutes', Icon: Landmark },
  { href: '/notes', label: 'Notes', Icon: NotebookPen },
  { href: '/quiz', label: 'Quiz', Icon: GraduationCap },
] as const;

export function HomeDesignA({
  name,
  signedIn = false,
  role,
}: {
  name?: string;
  signedIn?: boolean;
  role?: UserRole;
}) {
  const [input, setInput] = useState('');
  const [confidential, setConfidential] = useState(false);
  const composerAreaRef = useRef<HTMLDivElement>(null);

  // v1 parity: filling a prompt stub also focuses the textarea (places the
  // cursor / opens the mobile keyboard) so the user can complete the stub.
  const fillPrompt = (prompt: string) => {
    setInput(prompt);
    composerAreaRef.current?.querySelector('textarea')?.focus();
  };

  return (
    <div
      data-v2-marker="V2-HOME"
      data-design="a"
      className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col overflow-hidden px-4 pt-10 pb-8 md:justify-center md:py-16"
    >
      {/* Ambient warm spotlight — decorative, aria-hidden, built only from the
          --primary token at low opacity. Two layered radials (a wide static wash
          and a slower breathing core) give the light depth; the breathe is a
          whisper and is dropped entirely under reduced-motion. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[70%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.06] blur-[120px] md:top-[54%] dark:bg-primary/[0.12]" />
        <div
          className="absolute left-1/2 top-[72%] h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.12] blur-[90px] motion-safe:animate-pulse md:top-[56%] dark:bg-primary/20"
          style={{ animationDuration: '7s' }}
        />
      </div>

      {/* Greeting — Comfortaa, capped at v1's ~36px. Skeleton-first + confidential
          swap live inside HomeGreeting. */}
      <HomeGreeting
        name={name}
        confidential={confidential}
        align="center"
        headingClassName="font-comfortaa text-[1.75rem] font-semibold tracking-tight text-balance sm:text-[2rem] md:text-[2.25rem]"
      />

      {/* Quiet quick-jump nav — MOBILE ONLY (owner #20). Real `<a>` links to
          canonical paths (proxied to v1 for now). */}
      <nav
        aria-label="Quick links"
        className="mt-6 flex flex-wrap items-center justify-center gap-1.5 md:hidden"
      >
        {QUICK_ACTIONS.map(({ href, label, Icon }) => (
          <a
            key={href}
            href={href}
            className="v2-interactive inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </a>
        ))}
      </nav>

      {/* Compose cluster — pushed to the bottom on mobile (thumb-first) via
          `mt-auto`, folded into the centered hero on desktop (`md:mt-12`). */}
      <div className="mt-auto md:mt-12">
        {/* Ghost prompt chips. Mobile: an edge-to-edge single-line strip that
            scrolls (scrollbar hidden) so it never adds vertical bulk under the
            composer. Desktop: a centered wrap. They whisper until hovered. */}
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:mx-0 md:flex-wrap md:justify-center md:overflow-visible md:px-0 md:py-0 [&::-webkit-scrollbar]:hidden">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => fillPrompt(prompt)}
              className={cn(
                'v2-interactive inline-flex min-h-11 shrink-0 items-center rounded-full border border-border/60 px-4 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-h-9',
              )}
            >
              {prompt}…
            </button>
          ))}
        </div>

        {/* The shared v2-native composer — the ORIGINAL animated gold-shimmer
            border comes free from the default PromptInput variant. The ref is
            the prompt-fill focus target (v1's querySelector pattern). */}
        <div ref={composerAreaRef}>
          <HomeComposer
            value={input}
            onValueChange={setInput}
            signedIn={signedIn}
            role={role}
            confidential={confidential}
            onConfidentialChange={setConfidential}
            className="p-2.5 shadow-lg"
            textareaClassName="text-base md:text-lg"
            sendButtonClassName="md:size-10"
          />
        </div>
      </div>
    </div>
  );
}
