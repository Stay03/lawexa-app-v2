'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/auth';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { TimelineHome } from './TimelineHome';
import { HomePrompts } from './HomePrompts';
import { useComposerDraft } from './composer/useComposerDraft';
import {
  CHAT_COMPOSER_DOCK,
  CHAT_PROMPTS,
  CHAT_PROMPTS_HIDDEN,
  DOCK_FADE,
  HOME_GREETING_HEADING_FOCUSED,
  HOME_SURFACE_FOCUSED,
} from './home-frame';

/**
 * WorkHome — the Work tab (owner #34), REDESIGNED July 25.
 *
 * ── WHAT THE REDESIGN FIXED ─────────────────────────────────────────────────
 * The shipped version was a two-column workspace: composer and prompts on the
 * left, a rail of four bordered cards on the right (Your work spaces, Radar,
 * Recent conversations) plus a boxed "Jump back in". The owner asked for a clean
 * sleek surface and named the box; studying it first-hand, the box was one of
 * four problems, all of which this layout removes. `sections/HomeSection.tsx`
 * carries the full analysis. In short:
 *
 *  • ONE COLUMN. The rail is gone — not restyled, removed (owner: "remove those
 *    other card on the right from both tabs"). A rail of equal-weight cards beside
 *    the composer gave the eye no path; a single column has an obvious reading
 *    order. Radar and Your work spaces remain reachable from the sidebar, where
 *    navigation belongs.
 *  • NO BOXES. Sections are a quiet heading over bare rows.
 *  • THREE ROWS EACH. The home is a landing pad; the "All" link is where depth is.
 *  • WORK-THEMED PROMPTS. All three tabs used to show the same four legal
 *    prompts, so the most-read content on the page did not change with the tab.
 *
 * ── THE SAME FRAME AS CHAT, AND WHY THAT MATTERS ────────────────────────────
 * Work now uses `HOME_SURFACE_FOCUSED` — the identical single reading column Chat
 * uses — so the three tabs are one product with different contents rather than
 * three layouts. It also means the hard-won mobile mechanics come for free and
 * unchanged: the composer floats ALONE in a `sticky bottom-0` dock (never
 * `position: fixed` — shell-contract safe) so an overlaying keyboard cannot cover
 * it, with a soft fade dissolving the content scrolling behind.
 *
 * ── SIGNED IN, IT IS THE TIMELINE (24 October 2026) ────────────────────────
 * Stay said yes to "What's happening in your Work Spaces": a signed-in reader's
 * Work tab is the day-by-day timeline of their Work Spaces
 * (`v2/features/home-timeline`) under that heading, and nothing else. The
 * composer, the prompts and the Channel messages and Recent conversations
 * sections left the tab with it; a new chat starts from the Chat tab and the
 * sidebar.
 *
 * GUESTS get the honest minimum — greeting, composer, prompts. The timeline needs
 * a session and is never rendered for them, so it never fetches.
 */
export function WorkHome({
  name,
  signedIn = false,
  role,
}: {
  name?: string;
  signedIn?: boolean;
  role?: UserRole;
}) {
  if (signedIn) {
    return <TimelineHome tab="work" role={role} />;
  }
  return <WorkGuestHome name={name} role={role} />;
}

/** The Work tab for a guest: the greeting, the composer and the Work prompts. */
function WorkGuestHome({ name, role }: { name?: string; role?: UserRole }) {
  const [input, setInput] = useComposerDraft();
  const [confidential, setConfidential] = useState(false);
  // A redacted send waiting on this screen fades the prompts (`onRedactingChange`).
  const [redacting, setRedacting] = useState(false);
  const composerAreaRef = useRef<HTMLDivElement>(null);

  // v1 parity: filling a prompt stub also focuses the textarea (places the cursor /
  // opens the mobile keyboard) so the user can complete the stub.
  const fillPrompt = (prompt: string) => {
    setInput(prompt);
    composerAreaRef.current?.querySelector('textarea')?.focus();
  };

  return (
    <div data-v2-marker="V2-HOME" data-home-tab="work" className={HOME_SURFACE_FOCUSED}>
      <HomeGreeting
        name={name}
        confidential={confidential}
        align="center"
        subline="Your spaces and active matters, together in one place."
        headingClassName={HOME_GREETING_HEADING_FOCUSED}
      />

      {/* Composer dock — MOBILE: `sticky bottom-0`, pinned above the keyboard, with
          a soft bottom fade. DESKTOP: static, the hero under the greeting. No
          transform on the dock or the ref div — a transformed ancestor becomes the
          containing block and silently kills `position: sticky`. */}
      <div className={CHAT_COMPOSER_DOCK}>
        <div aria-hidden className={DOCK_FADE} />
        <div ref={composerAreaRef}>
          <HomeComposer
            value={input}
            onValueChange={setInput}
            signedIn={false}
            role={role}
            confidential={confidential}
            onConfidentialChange={setConfidential}
            className="p-2.5 shadow-lg"
            onRedactingChange={setRedacting}
            textareaClassName="text-base md:text-lg"
            sendButtonClassName="md:size-10"
          />
        </div>
      </div>

      {/* Suggested prompts — MOBILE: v1's stacked list sinking toward the thumb,
          just above the docked composer. DESKTOP: a quiet list under the composer. */}
      <div className={cn(CHAT_PROMPTS, redacting && CHAT_PROMPTS_HIDDEN)} aria-hidden={redacting || undefined}>
        <div className="md:hidden">
          <HomePrompts variant="mobile" tab="work" onSelect={fillPrompt} />
        </div>
        <div className="hidden md:block">
          <HomePrompts variant="desktop" tab="work" onSelect={fillPrompt} />
        </div>
      </div>
    </div>
  );
}
