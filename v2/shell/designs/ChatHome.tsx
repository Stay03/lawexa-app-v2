'use client';

import { useRef, useState } from 'react';
import { GraduationCap, Landmark, NotebookPen, Scale } from 'lucide-react';

import type { UserRole } from '@/types/auth';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { HomePrompts } from './HomePrompts';
import { useComposerDraft } from './composer/useComposerDraft';

/**
 * ChatHome — the Chat tab's home surface (owner #34: the default tab). The
 * shimmer composer is the lit centerpiece: a soft radial gold wash (built only
 * from the --primary token at low opacity) pools behind it, a Comfortaa greeting
 * sits above (capped at v1's ~36px), and everything else — the suggested prompts,
 * a quiet quick-jump row — recedes into generous negative space.
 *
 * DESKTOP is TOP-anchored (owner #25) but sits a few lines lower than the first
 * pass (owner #33: `md:pt-24` was too high) — `md:pt-36` lands between the old
 * too-low centre and that too-high anchor, still clearly reading from the top, not
 * cramped against the header. The desktop suggested prompts are a quiet
 * ChatGPT-style list UNDER the composer (owner #27), and the quick-jump row is
 * hidden (owner #20 — the sidebar already provides it).
 *
 * MOBILE stays thumb-first: the greeting rides the top, the quick-jump row sits
 * under it, and the compose cluster sinks to the bottom (`mt-auto`). The composer
 * itself floats ALONE in a `sticky bottom-0` dock — the SAME structure the
 * Work/Study tabs use — with the suggested prompts (v1's stacked list, owner #27)
 * sinking just above it. This replaced an earlier `mt-auto`-only column: in a
 * non-scrolling column there is nothing to scroll, so on browsers that OVERLAY the
 * keyboard (older WebView / Samsung Internet on budget phones like the Galaxy A21)
 * the composer sat half-behind the keyboard; the sticky dock pins it to the
 * shrunken viewport bottom, above the keyboard (owner keyboard-bug fix — the
 * root-cause half is the self-calibrating `--keyboard-inset`, see
 * use-keyboard-inset.ts).
 *
 * The greeting (`HomeGreeting`) is v1's REAL smart engine with the skeleton-first
 * reveal and the symmetric confidential-mode swap. Confidential is owned here so
 * the greeting and composer stay in lockstep. Suggested prompts are v1's ACTUAL
 * four (owner #21), shared via `HomePrompts`.
 *
 * Carries `data-home-tab="chat"` for the tab wrapper and the server-renderable
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

export function ChatHome({
  name,
  signedIn = false,
  role,
}: {
  name?: string;
  signedIn?: boolean;
  role?: UserRole;
}) {
  const [input, setInput] = useComposerDraft();
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
      data-home-tab="chat"
      className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pt-10 pb-8 md:pt-36 md:pb-12"
    >
      {/* Ambient warm spotlight (owner #32 — explicitly KEPT). Decorative,
          aria-hidden, built only from the --primary token at low opacity. Two
          layered radials (a wide static wash and a slower breathing core) give the
          light depth; the breathe is a whisper, dropped entirely under
          reduced-motion. Positioned low on mobile (composer docks at the thumb)
          and a touch below centre on desktop (tracks the composer's new lower
          anchor, owner #33) so the glow pools behind it in both.

          MOBILE gets the consistent treatment (owner #32): the layers are DIMMER
          below `md` (desktop opacities are unchanged — owner kept them).

          GLOW ARRIVAL (owner #36 — the shipped ~700ms read as a flash on tab
          switches): the whole container now BLOOMS in over a long ~2.2s soft
          ease-out with `fill-mode-both`, so the first frame is fully dim (never a
          pop) and the light gathers slowly rather than appearing. The surface
          roots key-remount, so this replays on every appearance — the first load
          AND every tab switch. It composes with the 200ms tab cross-fade by
          design: the surface fades in quickly while the glow is still gathering
          dim beneath it, so switching to Chat never flashes the light at strength.
          `motion-safe` guards it — reduced motion settles straight to visible,
          instant and unchanged. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-both motion-safe:duration-[2200ms] motion-safe:ease-out"
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

      {/* Composer dock — MOBILE: `sticky bottom-0` so it pins to the (keyboard-shrunk)
          viewport bottom rather than sitting half-behind an overlaying keyboard, with a
          soft bottom fade dissolving the content scrolling behind it (never
          `position: fixed` — shell-contract safe). DESKTOP: static, the approved
          top-anchored hero (`md:mt-10`). Hoisted to a DIRECT root-flex child (the SAME
          structure Work/Study use) so the tall root is its sticky containing block, not
          a short nested wrapper; `order` sequences it AFTER the prompts on mobile
          (thumb-docked) and BEFORE them on desktop. No transform lives on the sticky
          element or its inner ref div — transforms break `position: sticky`. The gold
          spotlight still pools behind it (the glow sits low on mobile / a touch below
          centre on desktop, unchanged). */}
      <div className="order-4 sticky bottom-0 z-10 -mx-4 px-4 pb-3 pt-6 md:order-3 md:static md:z-auto md:mx-0 md:mt-10 md:px-0 md:pb-0 md:pt-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background via-background/85 to-transparent md:hidden"
        />
        {/* The shared v2-native composer — the ORIGINAL animated gold-shimmer border
            comes free from the default PromptInput variant. The ref is the prompt-fill
            focus target (v1's querySelector pattern). */}
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

      {/* Suggested prompts — MOBILE: v1's stacked list sinking toward the thumb
          (`mt-auto`), just above the docked composer (owner #27). DESKTOP: a quiet
          ChatGPT-style list directly under the composer. Exactly one shows per
          breakpoint. */}
      <div className="order-3 mt-auto pt-8 md:order-4 md:mt-3 md:pt-0">
        <div className="md:hidden">
          <HomePrompts variant="mobile" onSelect={fillPrompt} />
        </div>
        <div className="hidden md:block">
          <HomePrompts variant="desktop" onSelect={fillPrompt} />
        </div>
      </div>
    </div>
  );
}
