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
 * shimmer composer is the centerpiece, a Comfortaa greeting sits above (capped at
 * v1's ~36px), and everything else — the suggested prompts, a quiet quick-jump row
 * — recedes into generous negative space.
 *
 * NO AMBIENT SPOTLIGHT. A soft radial gold wash used to pool behind the composer
 * (owner #32/#36). The owner removed it outright on July 25 — the whole effect, not
 * a tuning — so the surface now carries no decorative light at all. Do not
 * reintroduce one without asking; it was tried, refined twice, and dropped.
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
