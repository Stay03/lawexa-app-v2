'use client';

import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/auth';
import { HomeGreeting } from './HomeGreeting';
import { TimelineHome } from './TimelineHome';
import { HomePrompts } from './HomePrompts';
import { useFillPrompt, useHomeComposer } from './home-composer-context';
import {
  CHAT_PROMPTS,
  CHAT_PROMPTS_HIDDEN,
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
 * GUESTS get the honest minimum — greeting and prompts, over the shared box. The
 * timeline needs a session and is never rendered for them, so it never fetches. *
 * ── ONE BOX FOR THE THREE TABS (24 October 2026) ───────────────────────────
 * Stay: "same chat box with the chat tab ... the tabs switch but the chat box
 * remains". The box is no longer this surface's: `HomeFrame`, in the home
 * layout, draws it once under Chat, Work and Study, so switching tabs keeps
 * what was typed. This surface draws only its content, and reads the box's
 * state (confidential, a held send, the prompt fill) from
 * `home-composer-context`.
 */
export function WorkHome({
  name,
  signedIn = false,
}: {
  name?: string;
  signedIn?: boolean;
  role?: UserRole;
}) {
  if (signedIn) {
    return <TimelineHome tab="work" />;
  }
  return <WorkGuestHome name={name} />;
}

/**
 * The Work tab for a guest: the greeting and the Work prompts, over the
 * home's shared box (`HomeFrame`), which the prompts fill and focus.
 */
function WorkGuestHome({ name }: { name?: string }) {
  const { confidential, redacting } = useHomeComposer();
  const fillPrompt = useFillPrompt();

  return (
    <div data-v2-marker="V2-HOME" data-home-tab="work" className={HOME_SURFACE_FOCUSED}>
      <HomeGreeting
        name={name}
        confidential={confidential}
        align="center"
        subline="Your spaces and active matters, together in one place."
        headingClassName={HOME_GREETING_HEADING_FOCUSED}
      />

      {/* The prompts sink to just above the shared box, on a phone and a
          computer alike, and fade while a redacted send is held. */}
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
