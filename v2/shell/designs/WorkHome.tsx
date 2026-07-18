'use client';

import { useRef, useState } from 'react';

import type { UserRole } from '@/types/auth';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { HomePrompts } from './HomePrompts';

/**
 * WorkHome — the Work tab's home surface (owner #34). An HONEST MINIMUM this wave:
 * the shared greeting + composer + suggested prompts, composed like the Chat home
 * so it reads as a complete, intentional surface the moment the owner flips to it
 * — just QUIETER. Wave T2 fills this tab with its real modules (work spaces with
 * unread/mention rollup badges, "Jump back in" channels, Radar activity, recent
 * conversations). None of those load yet, so there is deliberately NO module
 * scaffolding and NO skeletons here — a skeleton would imply something is
 * loading; nothing is. The tab's PURPOSE is hinted only by a quiet greeting
 * subline, not by placeholder furniture.
 *
 * Layout mirrors the Chat home for continuity across the tab swap (greeting rides
 * the top; the compose cluster is pushed to the thumb on mobile via `mt-auto` and
 * folded near the top-anchored composer on desktop), minus the Chat tab's warm
 * spotlight and quick-jump row — the two elements that give Chat its louder
 * identity. The greeting (`HomeGreeting`) is v1's REAL smart engine with the
 * skeleton-first reveal and the symmetric confidential-mode swap; confidential is
 * owned here so greeting + composer stay in lockstep. The composer stays visible
 * on every tab (owner #34). Suggested prompts are v1's ACTUAL four (owner #21),
 * shared via `HomePrompts`.
 *
 * Carries `data-home-tab="work"` for the tab wrapper and the server-renderable
 * `data-v2-marker="V2-HOME"` marker the curl matrix greps for. Complete without
 * `name` (guests), which is threaded in when present.
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
  const [input, setInput] = useState('');
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
      data-home-tab="work"
      className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pt-10 pb-8 md:pt-36 md:pb-12"
    >
      {/* Greeting — Comfortaa, capped at v1's ~36px. The quiet subline hints the
          tab's purpose (spaces + active matters) without promising furniture that
          hasn't shipped; skeleton-first + the symmetric confidential swap live
          inside HomeGreeting. */}
      <HomeGreeting
        name={name}
        confidential={confidential}
        align="center"
        subline="Your spaces and active matters, together in one place."
        headingClassName="font-comfortaa text-[1.75rem] font-semibold tracking-tight text-balance sm:text-[2rem] md:text-[2.25rem]"
      />

      {/* Compose cluster — thumb-first on mobile via `mt-auto`, folded near the
          top-anchored greeting on desktop (`md:mt-10`). */}
      <div className="mt-auto md:mt-10">
        {/* MOBILE prompts — v1's stacked list, just above the docked composer. */}
        <div className="mb-3 md:hidden">
          <HomePrompts variant="mobile" onSelect={fillPrompt} />
        </div>

        {/* The shared v2-native composer (owner #34 — stays visible on every tab).
            The ref is the prompt-fill focus target (v1's querySelector pattern). */}
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

        {/* DESKTOP prompts — a quiet ChatGPT-style list under the composer
            (owner #27). Hidden on mobile. */}
        <div className="mt-3 hidden md:block">
          <HomePrompts variant="desktop" onSelect={fillPrompt} />
        </div>
      </div>
    </div>
  );
}
