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
 * StudyHome — the Study tab (owner #34).
 *
 * ── SIGNED IN, IT IS THE TIMELINE (24 October 2026) ────────────────────────
 * The same change as Work (`WorkHome` carries it): a signed-in reader's Study
 * tab is the day-by-day timeline of their Study Spaces under "What's happening
 * in your Study Spaces", and nothing else. The composer went with it, and so
 * did the student-only study-mode row and chip, which only ever changed the
 * turn that composer sent; Channel messages, Recent conversations and Recently
 * viewed left too.
 *
 * GUESTS get the greeting and the study-themed prompts, over the shared box —
 * understand, summarise, compare, test yourself. Study mode was never theirs
 * (it is student-gated on the signed-in profile). *
 * ── ONE BOX FOR THE THREE TABS (24 October 2026) ───────────────────────────
 * Stay: "same chat box with the chat tab ... the tabs switch but the chat box
 * remains". The box is no longer this surface's: `HomeFrame`, in the home
 * layout, draws it once under Chat, Work and Study, so switching tabs keeps
 * what was typed. This surface draws only its content, and reads the box's
 * state (confidential, a held send, the prompt fill) from
 * `home-composer-context`.
 */
export function StudyHome({
  name,
  signedIn = false,
}: {
  name?: string;
  signedIn?: boolean;
  role?: UserRole;
}) {
  if (signedIn) {
    return <TimelineHome tab="study" />;
  }
  return <StudyGuestHome name={name} />;
}

/**
 * The Study tab for a guest: the greeting and the Study prompts, over the
 * home's shared box (`HomeFrame`), which the prompts fill and focus.
 */
function StudyGuestHome({ name }: { name?: string }) {
  const { confidential, redacting } = useHomeComposer();
  const fillPrompt = useFillPrompt();

  return (
    <div data-v2-marker="V2-HOME" data-home-tab="study" className={HOME_SURFACE_FOCUSED}>
      <HomeGreeting
        name={name}
        confidential={confidential}
        align="center"
        subline="Everything you're learning, in one place."
        headingClassName={HOME_GREETING_HEADING_FOCUSED}
      />

      {/* The prompts sink to just above the shared box, on a phone and a
          computer alike, and fade while a redacted send is held. */}
      <div className={cn(CHAT_PROMPTS, redacting && CHAT_PROMPTS_HIDDEN)} aria-hidden={redacting || undefined}>
        <div className="md:hidden">
          <HomePrompts variant="mobile" tab="study" onSelect={fillPrompt} />
        </div>
        <div className="hidden md:block">
          <HomePrompts variant="desktop" tab="study" onSelect={fillPrompt} />
        </div>
      </div>
    </div>
  );
}
