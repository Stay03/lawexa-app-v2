'use client';

import { useRef, useState } from 'react';
import { GraduationCap, Landmark, NotebookPen, Scale } from 'lucide-react';

import type { UserRole } from '@/types/auth';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { HomePrompts } from './HomePrompts';

/**
 * HomeDesignA — "Warm Spotlight". The shimmer composer is the lit centerpiece:
 * a soft radial gold wash (built only from the --primary token at low opacity)
 * pools behind it, a Comfortaa greeting sits above (capped at v1's ~36px), and
 * everything else — the suggested prompts, a quiet quick-jump row — recedes into
 * generous negative space.
 *
 * DESKTOP is TOP-anchored (owner #25) but sits a few lines lower than the first
 * pass (owner #33: `md:pt-24` was too high) — `md:pt-36` lands between the old
 * too-low centre and that too-high anchor, still clearly reading from the top, not
 * cramped against the header. The desktop suggested prompts are a quiet
 * ChatGPT-style list UNDER the composer (owner #27), and the quick-jump row is
 * hidden (owner #20 — the sidebar already provides it).
 *
 * MOBILE stays thumb-first: the greeting rides the top, the quick-jump row sits
 * under it, and the compose cluster is pushed to the bottom via `mt-auto`. The
 * suggested prompts there are v1's stacked list, sitting just above the docked
 * composer (owner #27).
 *
 * The greeting (`HomeGreeting`) is v1's REAL smart engine with the skeleton-first
 * reveal and the symmetric confidential-mode swap. Confidential is owned here so
 * the greeting and composer stay in lockstep. Suggested prompts are v1's ACTUAL
 * four (owner #21), shared via `HomePrompts`.
 *
 * Carries `data-design="a"` for the switch and the server-renderable
 * `data-v2-marker="V2-HOME"` marker the curl matrix greps for. Complete without
 * `name` (guests), which is threaded in when present.
 */

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
      className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col overflow-hidden px-4 pt-10 pb-8 md:pt-36 md:pb-12"
    >
      {/* Ambient warm spotlight (owner #32 — explicitly KEPT). Decorative,
          aria-hidden, built only from the --primary token at low opacity. Two
          layered radials (a wide static wash and a slower breathing core) give the
          light depth; the breathe is a whisper, dropped entirely under
          reduced-motion. Positioned low on mobile (composer docks at the thumb)
          and a touch below centre on desktop (tracks the composer's new lower
          anchor, owner #33) so the glow pools behind it in both.

          MOBILE gets the consistent treatment (owner #32): the layers are DIMMER
          below `md` (desktop opacities are unchanged — owner kept them), and the
          whole container fades in on its OWN slow ~700ms curve on mount, so
          switching to this design never flashes the glow at full strength (the
          design roots key-remount, so the fade replays each appearance).
          `motion-safe` guards it — reduced motion settles straight to visible. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-both motion-safe:duration-700 motion-safe:ease-out"
      >
        <div className="absolute left-1/2 top-[70%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px] bg-primary/[0.03] dark:bg-primary/[0.06] md:top-[46%] md:bg-primary/[0.06] md:dark:bg-primary/[0.12]" />
        <div
          className="absolute left-1/2 top-[72%] h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] motion-safe:animate-pulse bg-primary/[0.06] dark:bg-primary/10 md:top-[48%] md:bg-primary/[0.12] md:dark:bg-primary/20"
          style={{ animationDuration: '7s' }}
        />
      </div>

      {/* Greeting — Comfortaa, capped at v1's ~36px. Skeleton-first + the symmetric
          confidential swap live inside HomeGreeting. */}
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
          `mt-auto`, folded near the top on desktop (`md:mt-10`, top-anchored). */}
      <div className="mt-auto md:mt-10">
        {/* MOBILE prompts — v1's stacked list, just above the docked composer. */}
        <div className="mb-3 md:hidden">
          <HomePrompts variant="mobile" onSelect={fillPrompt} />
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

        {/* DESKTOP prompts — a quiet ChatGPT-style list under the composer
            (owner #27). Hidden on mobile. */}
        <div className="mt-3 hidden md:block">
          <HomePrompts variant="desktop" onSelect={fillPrompt} />
        </div>
      </div>
    </div>
  );
}
