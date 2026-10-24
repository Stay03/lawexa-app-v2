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
 * GUESTS get the greeting, the composer and the study-themed prompts —
 * understand, summarise, compare, test yourself. Study mode was never theirs
 * (it is student-gated on the signed-in profile).
 */
export function StudyHome({
  name,
  signedIn = false,
  role,
}: {
  name?: string;
  signedIn?: boolean;
  role?: UserRole;
}) {
  if (signedIn) {
    return <TimelineHome tab="study" role={role} />;
  }
  return <StudyGuestHome name={name} role={role} />;
}

/** The Study tab for a guest: the greeting, the composer and the Study prompts. */
function StudyGuestHome({ name, role }: { name?: string; role?: UserRole }) {
  const [input, setInput] = useComposerDraft();
  const [confidential, setConfidential] = useState(false);
  // A redacted send waiting on this screen fades the prompts (`onRedactingChange`).
  const [redacting, setRedacting] = useState(false);
  const composerAreaRef = useRef<HTMLDivElement>(null);

  const fillPrompt = (prompt: string) => {
    setInput(prompt);
    composerAreaRef.current?.querySelector('textarea')?.focus();
  };

  return (
    <div data-v2-marker="V2-HOME" data-home-tab="study" className={HOME_SURFACE_FOCUSED}>
      <HomeGreeting
        name={name}
        confidential={confidential}
        align="center"
        subline="Everything you're learning, in one place."
        headingClassName={HOME_GREETING_HEADING_FOCUSED}
      />

      {/* Composer dock — see WorkHome for the sticky-dock contract. */}
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
