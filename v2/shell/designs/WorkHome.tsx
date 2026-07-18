'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { canAccessSpaces } from '@/lib/utils/spaces-access';
import type { UserRole } from '@/types/auth';
import { REVEAL } from './modules';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { HomePrompts } from './HomePrompts';
import { WorkSpacesModule } from './work/WorkSpacesModule';
import { JumpBackInModule } from './work/JumpBackInModule';
import { RadarModule } from './work/RadarModule';
import { RecentConversationsModule } from './work/RecentConversationsModule';

/**
 * WorkHome — the Work tab's home surface (owner #34). The shared greeting +
 * composer + prompts stay the primary action; the Work modules — "Your work
 * spaces", "Jump back in", Radar, Recent conversations — compose around them. The
 * composer stays visible on every tab (owner #34).
 *
 * DESKTOP LAYOUT (owner #37 — the shipped grid orphaned its prompts in a void).
 * The failure was structural: the old grid pinned the composer and prompts into
 * separate rows that a tall, row-SPANNING rail shared, so when the rail was taller
 * than the left column, `items-start` inflated those shared row tracks and left
 * the composer stranded at the top with the prompts orphaned far below.
 *
 * The fix makes orphaning impossible: two TOP-ALIGNED columns, each a single grid
 * cell that flows its own content independently (no shared, spanned row tracks).
 *   - LEFT (primary, ~1fr): the TIGHT compose cluster — composer, then the
 *     suggested prompts immediately beneath — and, below them, the "Jump back in"
 *     resume-hero (research: Notion's home leads with exactly this module), given
 *     the wide column so its channel previews breathe. This column can end
 *     shorter or taller than the rail with no void either way.
 *   - RIGHT (rail, 20rem): the glance modules — Your work spaces, Radar, Recent
 *     conversations.
 * The left column is `display:contents` on mobile (below), so the composer is NOT
 * nested there for layout — it hoists to the root scroll flex and its sticky dock
 * keeps working; on desktop the wrapper becomes the real left column.
 *
 * MOBILE keeps the hard-won structure: the greeting rides the top, the modules
 * (Jump back in, then the rail) scroll between, the prompts sink toward the thumb
 * (`mt-auto`), and the composer floats ALONE in a sticky bottom dock (never
 * `position: fixed` — shell-contract safe) with a mobile-only gradient fade
 * dissolving the scrolling content behind it. Per-block `order` interleaves the
 * left-column children with the rail into one scroll; the sticky dock's containing
 * block is the root, so it docks across the whole scroll.
 *
 * GUESTS get the honest minimum — greeting + composer + prompts, centered and
 * thumb-docked (the modules need a session and are never rendered, so they never
 * fetch). ONE subtle staggered entrance (`REVEAL`, `fill-mode-both`,
 * `motion-reduce`-instant). Carries `data-home-tab="work"` + the server-renderable
 * `data-v2-marker="V2-HOME"` marker on every root.
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

  const showSpaces = canAccessSpaces(role);

  // SIGNED-IN — the workspace. Mobile is one flex column (`order` sequences the
  // blocks); desktop is the two-column grid (`md:grid` overrides the flex), with
  // greeting spanning the top and the two single-cell columns top-aligned below.
  return (
    <div
      data-v2-marker="V2-HOME"
      data-home-tab="work"
      className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pb-8 pt-8 sm:px-6 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-x-8 md:gap-y-6 md:pb-12 md:pt-12"
    >
      {/* Greeting — full-width, left-aligned (workspace feel). */}
      <div className={cn(REVEAL, 'order-1 duration-500 md:col-span-2 md:row-start-1')}>
        <HomeGreeting
          name={name}
          confidential={confidential}
          align="left"
          subline="Pick up where you left off, or start something new."
          headingClassName="font-comfortaa text-[26px] font-semibold leading-tight md:text-[32px]"
        />
      </div>

      {/* LEFT COLUMN — `display:contents` on mobile so the composer hoists to the
          root scroll flex (its sticky dock needs the root as its containing block);
          a real flex column (grid col 1) on desktop that flows independently of the
          rail, so it can never orphan. */}
      <div className="contents md:flex md:min-w-0 md:flex-col md:gap-4 md:col-start-1 md:row-start-2">
        {/* Composer dock — MOBILE: `sticky bottom-0`, floating alone with a soft
            bottom fade. DESKTOP: static, top of the left column. The reveal
            transform lives on the INNER wrapper so it never touches the sticky
            element (transforms break `position: sticky`). */}
        <div className="sticky bottom-0 z-10 order-5 -mx-4 px-4 pb-3 pt-6 sm:-mx-6 sm:px-6 md:static md:z-auto md:order-1 md:mx-0 md:px-0 md:pb-0 md:pt-0">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background via-background/85 to-transparent md:hidden"
          />
          <div
            ref={composerAreaRef}
            className={cn(REVEAL, 'duration-500')}
            style={{ animationDelay: '80ms' }}
          >
            <HomeComposer {...composerProps} />
          </div>
        </div>

        {/* Suggested prompts — MOBILE: `mt-auto` sinks them toward the thumb, above
            the docked composer (v1's stacked list). DESKTOP: directly under the
            composer, a quiet ChatGPT-style list (owner #27) — the tight cluster. */}
        <div
          className={cn(
            REVEAL,
            'order-4 mt-auto pt-8 duration-500 md:order-2 md:mt-0 md:pt-0',
          )}
          style={{ animationDelay: '160ms' }}
        >
          <div className="md:hidden">
            <HomePrompts variant="mobile" onSelect={fillPrompt} />
          </div>
          <div className="hidden md:block">
            <HomePrompts variant="desktop" onSelect={fillPrompt} />
          </div>
        </div>

        {/* Resume-hero — "Jump back in". Soft-launch role-gated in v1
            (canAccessSpaces: researcher/admin/superadmin) — the same rule applies
            here or plain users would hit a dead panel. MOBILE: scrolls right under
            the greeting (order-2). DESKTOP: the left column, below the compose
            cluster, where its previews get room. */}
        {showSpaces ? (
          <div
            className={cn(REVEAL, 'order-2 mt-6 duration-500 md:order-3 md:mt-0')}
            style={{ animationDelay: '200ms' }}
          >
            <JumpBackInModule />
          </div>
        ) : null}
      </div>

      {/* RAIL — the glance modules. MOBILE: scrolls between the resume-hero and the
          compose cluster (order-3). DESKTOP: the right column (grid col 2). */}
      <div
        className={cn(
          REVEAL,
          'order-3 mt-6 flex flex-col gap-4 duration-500 md:col-start-2 md:row-start-2 md:mt-0 md:min-w-0',
        )}
        style={{ animationDelay: '240ms' }}
      >
        {showSpaces ? <WorkSpacesModule /> : null}
        <RadarModule />
        <RecentConversationsModule />
      </div>
    </div>
  );
}
