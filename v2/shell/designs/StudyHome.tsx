'use client';

import { useRef, useState } from 'react';

import { useAuthStore } from '@/lib/stores/authStore';
import { canAccessCollab } from '@/lib/utils/collab-audience';
import type { UserRole } from '@/types/auth';
import { useMounted } from '@/v2/shell/use-mounted';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { HomePrompts } from './HomePrompts';
import { useComposerDraft } from './composer/useComposerDraft';
import {
  CHAT_COMPOSER_DOCK,
  CHAT_PROMPTS,
  DOCK_FADE,
  HOME_GREETING_HEADING_FOCUSED,
  HOME_SECTIONS,
  HOME_SURFACE_FOCUSED,
} from './home-frame';
import {
  ChannelMessagesSection,
  ConversationsSection,
  RecentlyViewedSection,
} from './sections/HomeSections';
import { StudyModeRow, StudyModeChip } from './study/StudyMode';

/**
 * StudyHome — the Study tab (owner #34), REDESIGNED July 25 to the same shape as
 * Work. See `WorkHome` for the redesign rationale and `sections/HomeSection.tsx`
 * for why the card is gone; only what is Study-specific is documented here.
 *
 * ── WHAT CHANGED BEYOND THE SHARED REDESIGN ─────────────────────────────────
 *  • QUIZ IS GONE from the home (owner). It was the tab's boxed hero — continue a
 *    session, a stats strip, recent topics — and it is still fully reachable at its
 *    own v1 routes. The home's job is to get you moving, not to hold a product.
 *  • THE RAIL IS GONE — Study spaces, Bookmarks, Recently viewed and Recent chats
 *    were four cards competing with the composer. Two of them survive as sections
 *    in the single column; Bookmarks and Study spaces move to the sidebar's
 *    territory.
 *  • THE ORDER IS THE OWNER'S: channel messages, then conversations, then three
 *    recently-viewed items.
 *  • STUDY-THEMED PROMPTS — understand, summarise, compare, test yourself.
 *
 * ── STUDY MODE SURVIVED, AS A ROW ───────────────────────────────────────────
 * The owner's section list did not mention it, but it is a real feature, not a
 * glance card: it sends `study_mode: true` with the turn, which changes how the
 * answer is written. Deleting it would remove a capability rather than tidy a
 * surface. It is rebuilt as a plain toggle ROW in the new language instead of a
 * bordered card, so it fits the clean layout without being lost.
 *
 * It stays STUDENT-gated exactly as v1 does (`profile.profession === 'student'`).
 * That read is client-only, so `useMounted` keeps the first client render identical
 * to the server's and the row fades in after hydration rather than causing a
 * mismatch.
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
  const [input, setInput] = useComposerDraft();
  const [confidential, setConfidential] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const composerAreaRef = useRef<HTMLDivElement>(null);

  const fillPrompt = (prompt: string) => {
    setInput(prompt);
    composerAreaRef.current?.querySelector('textarea')?.focus();
  };

  const mounted = useMounted();
  const profession = useAuthStore((s) => s.user?.profile?.profession);
  const isStudent = signedIn && mounted && profession === 'student';

  return (
    <div data-v2-marker="V2-HOME" data-home-tab="study" className={HOME_SURFACE_FOCUSED}>
      <HomeGreeting
        name={name}
        confidential={confidential}
        align="center"
        subline={
          signedIn
            ? 'Pick up your reading, or ask something new.'
            : "Everything you're learning, in one place."
        }
        headingClassName={HOME_GREETING_HEADING_FOCUSED}
      />

      {/* Composer dock — see WorkHome for the sticky-dock contract. */}
      <div className={CHAT_COMPOSER_DOCK}>
        <div aria-hidden className={DOCK_FADE} />
        <div ref={composerAreaRef}>
          {/* Study-mode marker — rides ABOVE the composer, animating symmetrically
              in and out (owner #24). Only mounted for students, matching the row. */}
          {isStudent ? (
            <StudyModeChip active={studyMode} onClear={() => setStudyMode(false)} />
          ) : null}
          <HomeComposer
            value={input}
            onValueChange={setInput}
            signedIn={signedIn}
            role={role}
            confidential={confidential}
            onConfidentialChange={setConfidential}
            studyMode={studyMode}
            className="p-2.5 shadow-lg"
            textareaClassName="text-base md:text-lg"
            sendButtonClassName="md:size-10"
          />
        </div>
      </div>

      <div className={CHAT_PROMPTS}>
        <div className="md:hidden">
          <HomePrompts variant="mobile" tab="study" onSelect={fillPrompt} />
        </div>
        <div className="hidden md:block">
          <HomePrompts variant="desktop" tab="study" onSelect={fillPrompt} />
        </div>
      </div>

      {signedIn ? (
        <div className={HOME_SECTIONS}>
          {isStudent ? (
            <StudyModeRow checked={studyMode} onCheckedChange={setStudyMode} />
          ) : null}
          {canAccessCollab(role) ? <ChannelMessagesSection /> : null}
          <ConversationsSection />
          <RecentlyViewedSection />
        </div>
      ) : null}
    </div>
  );
}
