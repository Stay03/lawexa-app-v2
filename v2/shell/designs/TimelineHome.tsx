'use client';

import { useState } from 'react';

import type { UserRole } from '@/types/auth';
import { HomeTimeline } from '@/v2/features/home-timeline/HomeTimeline';
import { HomeComposer } from './HomeComposer';
import { useComposerDraft } from './composer/useComposerDraft';
import { HOME_SURFACE_TIMELINE, TIMELINE_COMPOSER_DOCK, TIMELINE_DOCK_FADE } from './home-frame';

/**
 * TimelineHome — the Work or Study tab for a signed-in reader: the day-by-day
 * timeline of their Spaces, with the chat box pinned at the foot (Stay, 24
 * October 2026, on the timeline's push ask: "Yeah add it").
 *
 * THE SAME BOX AS THE CHAT TAB. `HomeComposer` with the same draft, the same
 * privacy switch and the same send, which starts a new chat. No prompt chips:
 * the timeline is the tab's content, and the chips stay on Chat.
 *
 * PINNED, IN FLOW. The dock is `sticky bottom-0` inside the shell's one
 * scroll container, never `fixed`, so it takes its own height after the
 * timeline: the last row scrolls up above the box instead of under it, and on
 * a phone the box rides the keyboard the way the Chat tab's does (the shell
 * sizes the scroll container to the visual viewport). `mt-auto` puts it at the
 * foot of a short timeline. The fade behind it dissolves the rows that scroll
 * under its top edge, at every width.
 */
export function TimelineHome({ tab, role }: { tab: 'work' | 'study'; role?: UserRole }) {
  const [input, setInput] = useComposerDraft();
  const [confidential, setConfidential] = useState(false);

  return (
    <div data-v2-marker="V2-HOME" data-home-tab={tab} className={HOME_SURFACE_TIMELINE}>
      <HomeTimeline type={tab} />
      <div className={TIMELINE_COMPOSER_DOCK}>
        <div aria-hidden className={TIMELINE_DOCK_FADE} />
        <HomeComposer
          value={input}
          onValueChange={setInput}
          signedIn
          role={role}
          confidential={confidential}
          onConfidentialChange={setConfidential}
          className="p-2.5 shadow-lg"
          textareaClassName="text-base md:text-lg"
          sendButtonClassName="md:size-10"
        />
      </div>
    </div>
  );
}
