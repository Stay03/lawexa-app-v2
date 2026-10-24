'use client';

import { cn } from '@/lib/utils';
import { HomeGreeting } from './HomeGreeting';
import { HomePrompts } from './HomePrompts';
import { HomeQuickJump } from './HomeQuickJump';
import { useFillPrompt, useHomeComposer } from './home-composer-context';
import {
  CHAT_PROMPTS,
  CHAT_PROMPTS_HIDDEN,
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
 * `HomeQuickJump` for the same reason (only the real component reserves the
 * real height; its pills keep to one line). Nothing about the design changed in the extraction.
 *
 * ── ONE BOX FOR THE THREE TABS (24 October 2026) ───────────────────────────
 * Stay: "same chat box with the chat tab ... the tabs switch but the chat box
 * remains". The box is no longer this surface's: `HomeFrame`, in the home
 * layout, draws it once under Chat, Work and Study, so switching tabs keeps
 * what was typed. This surface draws only its content, and reads the box's
 * state (confidential, a held send, the prompt fill) from
 * `home-composer-context`.
 * On a computer that moves Chat's box from under the greeting to the foot of
 * the screen, as on a phone: the greeting stays at the top of the column and
 * the prompts sink to just above the box.
 */

export function ChatHome({ name }: { name?: string }) {
  const { confidential, redacting } = useHomeComposer();
  // v1 parity: filling a prompt stub also focuses the box (places the cursor /
  // opens the mobile keyboard) so the user can complete the stub.
  const fillPrompt = useFillPrompt();

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
          canonical paths. Shared with the route fallback so the reserved row
          wraps exactly like this one. */}
      <HomeQuickJump />

      {/* Suggested prompts — sinking toward the thumb (`mt-auto`), just above the
          shared box, on a phone and a computer alike (owner #27). Exactly one
          shows per breakpoint. */}
      <div className={cn(CHAT_PROMPTS, redacting && CHAT_PROMPTS_HIDDEN)} aria-hidden={redacting || undefined}>
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
