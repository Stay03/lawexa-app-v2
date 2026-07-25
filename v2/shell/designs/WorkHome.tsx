'use client';

import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { canAccessSpaces } from '@/lib/utils/spaces-access';
import type { UserRole } from '@/types/auth';
import { REVEAL } from './modules';
import { HomeGreeting } from './HomeGreeting';
import { HomeComposer } from './HomeComposer';
import { HomePrompts } from './HomePrompts';
import { useComposerDraft } from './composer/useComposerDraft';
import {
  DOCK_FADE,
  HOME_GREETING_HEADING_FOCUSED,
  HOME_GREETING_HEADING_WORKSPACE,
  HOME_SURFACE_FOCUSED,
  HOME_SURFACE_WORKSPACE,
  WORKSPACE_COMPOSER_DOCK,
  WORKSPACE_GREETING,
  WORKSPACE_LEFT_COLUMN,
  WORKSPACE_PRIMARY_MODULE,
  WORKSPACE_PROMPTS,
  WORKSPACE_RAIL,
} from './home-frame';
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
 * fetch). Carries `data-home-tab="work"` + the server-renderable
 * `data-v2-marker="V2-HOME"` marker on every root.
 *
 * ── THE ENTRANCE RULE: A BLOCK THE FALLBACK PRE-DRAWS GETS NO ENTRANCE ──────
 * `REVEAL` is `fill-mode-both` over a `from`-only enter keyframe, so a block
 * carrying it is held fully INVISIBLE for its whole `animationDelay` and only
 * then fades up over its duration. That is right for something arriving from
 * nowhere — and actively wrong for something the route fallback has already
 * painted, because the block visibly BLANKS at the hand-off and then fades back
 * in. With the old stagger (80/160/240ms delays over 500ms) the artifact ran to
 * roughly 740ms.
 *
 * So the greeting, composer, prompts and rail — every block `HomeFallback` draws
 * — now render plainly, and the hand-off is seamless. "Jump back in" KEEPS
 * `REVEAL`: it is role-gated, the fallback deliberately omits it, and it really
 * does arrive with the payload. Its stagger delay is dropped, since it is no
 * longer part of a sequence. (Chat needed no change — `ChatHome` never had
 * `REVEAL`.)
 *
 * FRAME: every container class below comes from `home-frame.ts` — the ONE
 * definition the route-level fallback (`HomeFallback`) also consumes, so the
 * loading shape and this surface cannot drift apart. That module also documents
 * the two mechanics this layout depends on and that are easy to break: the
 * `contents md:flex` left column (which keeps the sticky dock's containing block
 * tall on mobile) and the shared mobile `order` scale. The extraction renumbered
 * this tab's mobile `order` values onto that shared scale — the rendered sequence
 * (greeting → jump back in → rail → prompts → composer) is unchanged, since
 * `order` is a sort key and the gap it leaves is inert.
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
  const [input, setInput] = useComposerDraft();
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
        className={HOME_SURFACE_FOCUSED}
      >
        <HomeGreeting
          name={name}
          confidential={confidential}
          align="center"
          subline="Your spaces and active matters, together in one place."
          headingClassName={HOME_GREETING_HEADING_FOCUSED}
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
      className={HOME_SURFACE_WORKSPACE}
    >
      {/* Greeting — full-width, left-aligned (workspace feel). NO entrance: the
          route fallback already drew this block (see the ENTRANCE RULE above). */}
      <div className={WORKSPACE_GREETING}>
        <HomeGreeting
          name={name}
          confidential={confidential}
          align="left"
          subline="Pick up where you left off, or start something new."
          headingClassName={HOME_GREETING_HEADING_WORKSPACE}
        />
      </div>

      {/* LEFT COLUMN — `display:contents` on mobile so the composer hoists to the
          root scroll flex (its sticky dock needs the root as its containing block);
          a real flex column (grid col 1) on desktop that flows independently of the
          rail, so it can never orphan. */}
      <div className={WORKSPACE_LEFT_COLUMN}>
        {/* Composer dock — MOBILE: `sticky bottom-0`, floating alone with a soft
            bottom fade. DESKTOP: static, top of the left column. NO entrance (the
            fallback pre-draws the composer's shape). The inner wrapper STAYS: it
            carries `composerAreaRef` for prompt-fill focus, and keeping the ref
            div free of transforms is what protects the sticky dock. */}
        <div className={WORKSPACE_COMPOSER_DOCK}>
          <div aria-hidden className={DOCK_FADE} />
          <div ref={composerAreaRef}>
            <HomeComposer {...composerProps} />
          </div>
        </div>

        {/* Suggested prompts — MOBILE: `mt-auto` sinks them toward the thumb, above
            the docked composer (v1's stacked list). DESKTOP: directly under the
            composer, a quiet ChatGPT-style list (owner #27) — the tight cluster. */}
        <div className={WORKSPACE_PROMPTS}>
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
            cluster, where its previews get room.

            KEEPS its entrance — the fallback deliberately does not draw this
            role-gated module, so it genuinely arrives with the payload. The
            stagger delay is gone: there is no sequence left to stagger against. */}
        {showSpaces ? (
          <div className={cn(REVEAL, WORKSPACE_PRIMARY_MODULE, 'duration-500')}>
            <JumpBackInModule />
          </div>
        ) : null}
      </div>

      {/* RAIL — the glance modules. MOBILE: scrolls between the resume-hero and the
          compose cluster (order-4). DESKTOP: the right column (grid col 2). */}
      <div className={WORKSPACE_RAIL}>
        {showSpaces ? <WorkSpacesModule /> : null}
        <RadarModule />
        <RecentConversationsModule />
      </div>
    </div>
  );
}
