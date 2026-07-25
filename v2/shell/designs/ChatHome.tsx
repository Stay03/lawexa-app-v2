'use client';

import { useRef, useState } from 'react';

import type { UserRole } from '@/types/auth';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { HomePrompts } from './HomePrompts';
import { HomeQuickJump } from './HomeQuickJump';
import { useComposerDraft } from './composer/useComposerDraft';
import {
  CHAT_COMPOSER_DOCK,
  CHAT_PROMPTS,
  DOCK_FADE,
  HOME_GREETING_HEADING_FOCUSED,
  HOME_SURFACE_FOCUSED,
} from './home-frame';

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
 *
 * FRAME: every container class below comes from `home-frame.ts` — the ONE
 * definition the route-level fallback (`HomeFallback`) also consumes, so the
 * loading shape and this surface cannot drift apart. The quick-jump row moved to
 * `HomeQuickJump` for the same reason (its pills wrap, so only the real component
 * reserves the real height). Nothing about the design changed in the extraction.
 */

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
      className={HOME_SURFACE_FOCUSED}
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
        headingClassName={HOME_GREETING_HEADING_FOCUSED}
      />

      {/* Quiet quick-jump nav — MOBILE ONLY (owner #20). Real `<a>` links to
          canonical paths (proxied to v1 for now). Shared with the route fallback
          so the reserved row wraps exactly like this one. */}
      <HomeQuickJump />

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
      <div className={CHAT_COMPOSER_DOCK}>
        <div aria-hidden className={DOCK_FADE} />
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
      <div className={CHAT_PROMPTS}>
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
