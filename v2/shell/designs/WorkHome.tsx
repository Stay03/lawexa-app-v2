'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { canAccessSpaces } from '@/lib/utils/spaces-access';
import type { UserRole } from '@/types/auth';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { HomePrompts } from './HomePrompts';
import { WorkSpacesModule } from './work/WorkSpacesModule';
import { JumpBackInModule } from './work/JumpBackInModule';
import { RadarModule } from './work/RadarModule';
import { RecentConversationsModule } from './work/RecentConversationsModule';

/**
 * WorkHome — the Work tab's home surface (owner #34). The shared greeting +
 * composer + prompts stay the primary action; around them sit the Work modules:
 * "Your work spaces" (`?type=work`, with the §17 unread/mention rollup badges),
 * "Jump back in" (the most-active channels across those spaces), Radar (active
 * watches), and a recent-conversations strip. The composer stays visible on
 * every tab (owner #34).
 *
 * GUESTS get the honest minimum — greeting + composer + prompts, centered and
 * thumb-docked, exactly the minimal surface they saw before (the modules need a
 * session and are hidden entirely). All the module query hooks live inside the
 * module components, so for guests those components are simply never rendered and
 * never fetch.
 *
 * SIGNED-IN LAYOUT:
 *  - DESKTOP is a deliberate workspace grid (the retired Design B's proven DNA):
 *    a full-width greeting, then the composer + suggested prompts in the left
 *    column and the module rail promoted to a full-height right column beside
 *    them — compose here, scan your activity there.
 *  - MOBILE keeps the composer off the floor (the B2 finding): the greeting rides
 *    the top, the modules scroll between, the prompts sink toward the thumb
 *    (`mt-auto`), and the composer floats ALONE in a sticky bottom dock (never
 *    `position: fixed` — shell-contract safe) with a mobile-only gradient fade
 *    dissolving the scrolling content behind it. `md:static` drops the dock on
 *    desktop.
 *
 * ONE subtle staggered entrance (fade + 8px rise, `fill-mode-both`,
 * `motion-reduce`-instant) layered under the tab's own cross-fade. Carries
 * `data-home-tab="work"` + the server-renderable `data-v2-marker="V2-HOME"`
 * marker on every root.
 */

/** The signature entrance: a soft fade + rise. `fill-mode-both` holds each block
 *  hidden through its stagger delay (no pre-flash); `motion-reduce` settles it to
 *  its natural, fully-visible state instantly. */
const REVEAL =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-500 motion-safe:ease-out';

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

  // Shared composer props — spread into the one composer each branch renders, so
  // the furniture can never drift between the guest and signed-in layouts.
  const composerProps = {
    value: input,
    onValueChange: setInput,
    signedIn,
    role,
    confidential,
    onConfidentialChange: setConfidential,
    className: 'p-2.5 shadow-lg',
    textareaClassName: 'text-base md:text-lg',
    sendButtonClassName: 'md:size-10',
  };

  // GUESTS — the minimal surface (no modules), centred + thumb-docked.
  if (!signedIn) {
    return (
      <div
        data-v2-marker="V2-HOME"
        data-home-tab="work"
        className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pt-10 pb-8 md:pt-36 md:pb-12"
      >
        <HomeGreeting
          name={name}
          confidential={confidential}
          align="center"
          subline="Your spaces and active matters, together in one place."
          headingClassName="font-comfortaa text-[1.75rem] font-semibold tracking-tight text-balance sm:text-[2rem] md:text-[2.25rem]"
        />

        <div className="mt-auto md:mt-10">
          <div className="mb-3 md:hidden">
            <HomePrompts variant="mobile" onSelect={fillPrompt} />
          </div>
          <div ref={composerAreaRef}>
            <HomeComposer {...composerProps} />
          </div>
          <div className="mt-3 hidden md:block">
            <HomePrompts variant="desktop" onSelect={fillPrompt} />
          </div>
        </div>
      </div>
    );
  }

  // SIGNED-IN — the full workspace.
  return (
    <div
      data-v2-marker="V2-HOME"
      data-home-tab="work"
      className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-8 sm:px-6 md:grid md:grid-cols-[minmax(0,1fr)_19rem] md:items-start md:gap-x-8 md:gap-y-6 md:py-12"
    >
      {/* Greeting — full-width, left-aligned (workspace feel). */}
      <div className={cn(REVEAL, 'md:col-span-2 md:row-start-1')}>
        <HomeGreeting
          name={name}
          confidential={confidential}
          align="left"
          subline="Pick up where you left off, or start something new."
          headingClassName="font-comfortaa text-[26px] font-semibold leading-tight md:text-[32px]"
        />
      </div>

      {/* Module rail — MOBILE: a stack that scrolls between the greeting and the
          docked composer. DESKTOP: promoted to the full-height right column. One
          block reveal; each module cross-fades its own skeleton → content. */}
      <div
        className={cn(
          REVEAL,
          'mt-8 flex flex-col gap-4 md:col-start-2 md:row-start-2 md:row-end-4 md:mt-0',
        )}
        style={{ animationDelay: '160ms' }}
      >
        {/* Spaces are soft-launch role-gated in v1 (canAccessSpaces:
            researcher/admin/superadmin, enforced by nav + SpacesGuard) — the
            same rule applies here or plain users would hit a permanent error
            card / a dead "Browse spaces" CTA (reviewer HIGH finding). */}
        {canAccessSpaces(role) ? (
          <>
            <WorkSpacesModule />
            <JumpBackInModule />
          </>
        ) : null}
        <RadarModule />
        <RecentConversationsModule />
      </div>

      {/* Suggested prompts — MOBILE: `mt-auto` sinks them toward the thumb, above
          the docked composer (v1's stacked list). DESKTOP: left column under the
          composer, as a quiet ChatGPT-style list (owner #27). */}
      <div
        className={cn(
          REVEAL,
          'mt-auto pt-8 md:col-start-1 md:row-start-3 md:mt-4 md:max-w-2xl md:pt-0',
        )}
        style={{ animationDelay: '200ms' }}
      >
        <div className="md:hidden">
          <HomePrompts variant="mobile" onSelect={fillPrompt} />
        </div>
        <div className="hidden md:block">
          <HomePrompts variant="desktop" onSelect={fillPrompt} />
        </div>
      </div>

      {/* Composer dock — MOBILE: `sticky bottom-0`, floating alone with a soft
          bottom fade. DESKTOP: static, left column under the greeting. The reveal
          transform lives on the INNER wrapper so it never touches the sticky
          element (transforms break `position: sticky`). */}
      <div className="sticky bottom-0 z-10 -mx-4 px-4 pb-3 pt-6 sm:-mx-6 sm:px-6 md:static md:z-auto md:col-start-1 md:row-start-2 md:mx-0 md:max-w-2xl md:px-0 md:pb-0 md:pt-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background via-background/85 to-transparent md:hidden"
        />
        <div
          ref={composerAreaRef}
          className={REVEAL}
          style={{ animationDelay: '80ms' }}
        >
          <HomeComposer {...composerProps} />
        </div>
      </div>
    </div>
  );
}
