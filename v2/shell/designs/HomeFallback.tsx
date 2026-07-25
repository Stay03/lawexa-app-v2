'use client';

import {
  Bookmark as BookmarkIcon,
  History,
  MessageSquare,
  Radar,
} from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { useHomeTab } from '@/v2/shell/home-tab';
import { HomePrompts } from './HomePrompts';
import { HomeQuickJump } from './HomeQuickJump';
import { Module, ModuleSkeleton } from './modules';
import {
  CHAT_COMPOSER_DOCK,
  CHAT_PROMPTS,
  DOCK_FADE,
  HOME_GREETING_SKELETON_HEADING,
  HOME_GREETING_SKELETON_SUBLINE,
  HOME_SURFACE_FOCUSED,
  HOME_SURFACE_WORKSPACE,
  WORKSPACE_COMPOSER_DOCK,
  WORKSPACE_GREETING,
  WORKSPACE_LEFT_COLUMN,
  WORKSPACE_PROMPTS,
  WORKSPACE_RAIL,
} from './home-frame';

/**
 * =============================================================================
 * HomeFallback — the v2 home's route-level loading UI (`app/v2/loading.tsx`)
 * =============================================================================
 * THE COMPLAINT THIS ANSWERS (owner, verbatim): "the home skeleton is always the
 * same even when its landing on either of the 3 tabs and none of the design of
 * the tab match the skeleton… i also notice the skeleton is of the textarea and
 * im not sure why that should have a loading skeleton… those part of the screens
 * should just appear immediately". Both halves were right. The old fallback drew
 * ONE vertically-centred `max-w-2xl` column that matched no tab (Chat is
 * top-anchored ~144px down on desktop; Work/Study are `max-w-5xl` two-column
 * grids), inverted the mobile composer/prompt order, dropped the quick-jump row,
 * and pulsed a skeleton over a textarea that never loads anything.
 *
 * ── HOW IT KNOWS WHICH TAB ──────────────────────────────────────────────────
 * The active tab lives ONLY in `localStorage` (`v2/shell/home-tab.ts`), so a
 * server-rendered fallback can never know it. A `loading.tsx` may however be a
 * CLIENT component (Next.js: "By default, this file is a Server Component - but
 * can also be used as a Client Component through the `use client` directive"),
 * which gives us the right shape in both directions:
 *
 *   HARD LOAD  — the fallback is part of the streamed static shell, so it renders
 *                on the SERVER: `useHomeTab()` reads `getServerSnapshot()` →
 *                `'chat'`. That is CORRECT, because the page it hands off to
 *                renders through the same server snapshot and also paints Chat;
 *                the stored tab is reconciled later, after hydration.
 *   SOFT NAV   — no HTML is transferred; React renders this client reference in
 *                the browser, so `useHomeTab()` reads the real `getSnapshot()`
 *                and we draw the tab the user is actually on.
 *
 * CORRECT EITHER WAY BY CONSTRUCTION: the tab only ever selects WHICH shared
 * frame is drawn, and Chat — the default, the server snapshot, and by far the
 * most common tab — is also the honest generic home shape (one reading column,
 * greeting → prompts → composer). So if the server snapshot were ever served on
 * a soft navigation, the result degrades to "a slightly narrower home frame",
 * never to a broken or misleading one. Nothing here depends on the client
 * snapshot being available.
 *
 * ── ONE KNOWN, BOUNDED GAP: GUESTS ON WORK/STUDY ────────────────────────────
 * This is a pure function of the tab; it does not read a session (it has none —
 * the session is exactly what the route is resolving). So a GUEST who has
 * deliberately selected Work or Study sees the signed-in workspace frame for the
 * length of the fallback, then the guest surface's narrower focused column.
 * Deliberately not papered over here, for three reasons: guests default to Chat,
 * and `ChatHome` has no guest branch at all, so the Chat fallback is already
 * exactly right for the overwhelming majority of guest sessions; the Work/Study
 * GUEST layouts do not share the signed-in frame in the first place (they group
 * the compose cluster under one `mt-auto` wrapper with NO sticky dock), so
 * covering them means extracting a third frame from a layout that is itself
 * inconsistent with the other two; and inferring the session from the client auth
 * store would introduce a second source of truth for "signed in" that can
 * disagree with the server. The right fix is to reconcile the guest surfaces with
 * the shared frame first — reported, not improvised here.
 *
 * ── WHY IT IS COMPLETELY INERT ──────────────────────────────────────────────
 * A Suspense fallback is throwaway UI. Verified in the React reconciler: when the
 * content resolves, the fallback fiber is a SIBLING of the content fiber and is
 * pushed to `deletions` with the `ChildDeletion` flag — a full unmount. DOM nodes
 * are removed, state is discarded, and the browser drops focus to `<body>`. On a
 * hard load it is worse: the streamed HTML is swapped by an inline script that
 * can run BEFORE hydration, so a control here may never have been interactive at
 * all. A real composer in the fallback is therefore a focus-stealing,
 * caret-destroying bug by construction — mid-typing focus loss is far worse than
 * a short wait. So the whole subtree is `inert` and `aria-hidden`, and the
 * composer appears only as a static reserved SHAPE at the exact real height. One
 * `role="status"` live region outside the hidden subtree carries the
 * announcement, so screen-reader users are told once rather than read a wall of
 * decorative boxes.
 *
 * KNOW WHAT `inert` DOES NOT DO. It suppresses focus, clicks, pointer events and
 * the accessibility tree — it does NOT stop React refs, IntersectionObservers or
 * network requests. Anything rendered here still MOUNTS and still runs its
 * effects. That is why the rail's header links carry `prefetch={false}` (see
 * `WorkRail`) and why nothing in this file may ever own a query, a subscription
 * or a timer. "Inert" is a guarantee about the USER's ability to interact, not
 * about the component doing nothing.
 *
 * ── WHAT GETS A SKELETON AND WHAT DOES NOT ──────────────────────────────────
 *  • STATIC CHROME renders FOR REAL, immediately — the suggested prompts and the
 *    quick-jump row are fixed strings with fixed routes, so they are the actual
 *    components (inert), not grey bars. This is the owner's "those parts should
 *    just appear immediately", and it is what Polaris states outright: "Show
 *    static content that never changes on a page and use skeleton loading for
 *    dynamic content."
 *  • THE COMPOSER gets a quiet, NON-PULSING reserved shape. It is not loading
 *    anything (its draft is a synchronous localStorage read, its placeholder is a
 *    literal, its buttons are static markup) — it just cannot be rendered live
 *    here, so we reserve its exact 118px footprint without claiming to load.
 *  • THE GREETING gets a real pulsing skeleton, because it genuinely IS blocked
 *    on this route's server work: its text is built from the signed-in first name
 *    that `verifySession()` resolves. It reuses `HomeGreeting`'s own skeleton
 *    geometry so the hand-off is skeleton → identical skeleton → text.
 *  • THE MODULE RAIL gets STILL `ModuleSkeleton`s inside real `Module` frames (a pulse promises a request; this boundary waits on an RSC payload, and the module queries beneath it are often already warm) —
 *    exactly what each module renders while its query is pending, so the fallback
 *    and the first mounted frame are the same picture.
 *
 * ── GEOMETRY ────────────────────────────────────────────────────────────────
 * Every container class comes from `home-frame.ts`, the single definition the
 * REAL surfaces also consume — including the mobile↔desktop `order` inversion and
 * the `contents md:flex` left column that keeps the sticky dock's containing
 * block tall on mobile. The fallback cannot drift from the surfaces because there
 * is nothing separate to drift.
 *
 * No entrance animation: this IS the "before" state, and delaying it would only
 * lengthen the blank. Its exit is covered by the incoming surface's own reveal.
 * The dock row is empty on home, so nothing here adds bottom safe-area padding.
 * =============================================================================
 */

/** `HomePrompts` requires a handler; nothing in an inert subtree can fire one. */
const NOOP = () => {};

export function HomeFallback() {
  const tab = useHomeTab();

  return (
    <>
      <span role="status" className="sr-only">
        Loading your home
      </span>
      <div aria-hidden inert className="h-full">
        {tab === 'work' ? (
          <WorkspaceFrame rail={<WorkRail />} />
        ) : tab === 'study' ? (
          <WorkspaceFrame rail={<StudyRail />} />
        ) : (
          <ChatFrame />
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Frames                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The Chat frame — the focused reading column. Mirrors `ChatHome` block for
 * block: greeting, the mobile quick-jump row, then the compose cluster, whose
 * `order` values put the prompts ABOVE the thumb-docked composer on mobile and
 * BELOW the composer on desktop.
 *
 * The ambient gold spotlight is deliberately NOT reproduced. `HomeGlow` blooms in
 * from fully dim over ~2.2s with `fill-mode-both`, so its first frame is invisible
 * anyway — drawing one here would either double the bloom or flash the light at
 * strength before the real one starts from zero. (The glow now lives in the
 * persistent home wrapper rather than in `ChatHome`, so it also survives tab swaps;
 * that changes nothing for this fallback, which is replaced wholesale the moment
 * the real home mounts.)
 */
function ChatFrame() {
  return (
    <div className={HOME_SURFACE_FOCUSED}>
      <GreetingSkeleton align="center" />

      {/* Static chrome — the real row, so the reserved space matches its wrap. */}
      <HomeQuickJump />

      <div className={CHAT_COMPOSER_DOCK}>
        <div className={DOCK_FADE} />
        <ComposerShape />
      </div>

      <div className={CHAT_PROMPTS}>
        <PromptsBlock />
      </div>
    </div>
  );
}

/**
 * The Work/Study frame — the two-column workspace. Only the RAIL differs between
 * the tabs, so it is a slot; everything structural is shared, which is what keeps
 * the two fallbacks from drifting apart the way the surfaces once did.
 *
 * The left column reserves the composer and the prompts only. The role-gated
 * modules ("Jump back in", Quiz, the study-mode CTA, and the spaces modules) are
 * NOT drawn: the fallback has no session, and inventing a panel that half the
 * audience never sees would trade one jump for a worse one. The rail therefore
 * shows exactly the modules every signed-in user gets.
 */
function WorkspaceFrame({ rail }: { rail: React.ReactNode }) {
  return (
    <div className={HOME_SURFACE_WORKSPACE}>
      <div className={WORKSPACE_GREETING}>
        <GreetingSkeleton align="left" subline />
      </div>

      {/* `contents` below md — its children join the ROOT flex so the `order`
          scale interleaves them with the rail and the sticky dock keeps the tall
          root as its containing block. */}
      <div className={WORKSPACE_LEFT_COLUMN}>
        <div className={WORKSPACE_COMPOSER_DOCK}>
          <div className={DOCK_FADE} />
          <ComposerShape />
        </div>

        <div className={WORKSPACE_PROMPTS}>
          <PromptsBlock />
        </div>
      </div>

      <div className={WORKSPACE_RAIL}>{rail}</div>
    </div>
  );
}

/**
 * The rails' ungated modules — the ones EVERY signed-in user gets.
 *
 * ROW COUNTS ARE NOT DECLARED HERE. `<ModuleSkeleton still />` is exactly what
 * each real module renders while pending, so the fallback inherits the one
 * shared reservation policy automatically. Hand-copying counts into this file
 * would silently reintroduce the very shift the policy removes the first time a
 * module's number changed — the drift class this whole workstream exists to kill.
 *
 * `prefetch: false` on every header action is load-bearing, not cosmetic:
 * `next/link` prefetches by default and registers with a shared
 * IntersectionObserver through a callback ref, and `inert` stops focus, clicks
 * and pointer events but NOT refs, observers or network. Without it this
 * about-to-be-deleted subtree fires real RSC prefetches for /radars, /bookmarks
 * and /conversations — invisible in dev, where prefetching is disabled, and live
 * in production. `inert` does cover the hover path, since inert content is not
 * hit-testable, so there is no `onMouseEnter` to trigger the eager fetch.
 */
function WorkRail() {
  return (
    <>
      <Module
        title="Radar"
        icon={Radar}
        action={{ href: '/radars', label: 'All', prefetch: false }}
      >
        <ModuleSkeleton still />
      </Module>
      <Module
        title="Recent conversations"
        icon={MessageSquare}
        action={{ href: '/conversations', label: 'All', prefetch: false }}
      >
        <ModuleSkeleton lines={1} still />
      </Module>
    </>
  );
}

/** The Study rail's ungated modules. See `WorkRail` for the counts + prefetch. */
function StudyRail() {
  return (
    <>
      <Module title="Recently viewed" icon={History}>
        <ModuleSkeleton still />
      </Module>
      <Module
        title="Bookmarks"
        icon={BookmarkIcon}
        action={{ href: '/bookmarks', label: 'All', prefetch: false }}
      >
        <ModuleSkeleton still />
      </Module>
      <Module
        title="Recent chats"
        icon={MessageSquare}
        action={{ href: '/conversations', label: 'All', prefetch: false }}
      >
        <ModuleSkeleton lines={1} still />
      </Module>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Reserved pieces                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The greeting's skeleton, at `HomeGreeting`'s own pre-mount geometry — the one
 * region on this surface that is genuinely blocked on the route's server work
 * (the greeting is built from the session's first name), so the one region a
 * pulsing skeleton honestly describes.
 */
function GreetingSkeleton({
  align,
  subline = false,
}: {
  align: 'center' | 'left';
  subline?: boolean;
}) {
  const centered = align === 'center';
  return (
    <header className={centered ? 'text-center' : 'text-left'}>
      <div
        className={
          centered ? 'flex flex-col items-center gap-2' : 'flex flex-col gap-2'
        }
      >
        <Skeleton className={HOME_GREETING_SKELETON_HEADING} />
        {subline ? <Skeleton className={HOME_GREETING_SKELETON_SUBLINE} /> : null}
      </div>
    </header>
  );
}

/** Both prompt presentations, each CSS-gated to its breakpoint — exactly how the
 *  real surfaces render them, so precisely one is ever visible. */
function PromptsBlock() {
  return (
    <>
      <div className="md:hidden">
        <HomePrompts variant="mobile" onSelect={NOOP} />
      </div>
      <div className="hidden md:block">
        <HomePrompts variant="desktop" onSelect={NOOP} />
      </div>
    </>
  );
}

/**
 * The composer's reserved shape — QUIET AND STILL, never a pulse.
 *
 * The real composer loads nothing: the draft comes from a synchronous
 * localStorage read in a lazy `useState`, the placeholder is a string literal,
 * and the send button, plus-menu and privacy toggles are static markup. The only
 * two fetching parts (`WorkflowField`, which is `enabled: isAdmin` and so is
 * never pending for a normal user, and `JurisdictionField`) already skeleton
 * themselves IN PLACE at fixed geometry. So a pulsing composer here would claim
 * something is loading that is not — the owner spotted exactly this.
 *
 * What it does need is its SPACE. The height is built structurally, not from a
 * magic number, mirroring the real stack one element at a time:
 *
 *     ring `p-[1px]`                              2px
 *   + card `p-2.5`                               20px
 *   + textarea box `py-3` + one line `h-6/md:h-7` 48px  (52px from md)
 *   + action row `pb-1` + `size-11`/`md:size-10` 48px  (44px from md)
 *   ------------------------------------------------------------------
 *     total                                     118px at every breakpoint
 *
 * A plain `bg-border` hairline stands in for the animated gold shimmer and the
 * marks are flat `bg-muted` — so it reads unmistakably as "the composer goes
 * here", never as a live control the user can type into and never as a spinner.
 *
 * COUPLING NOTE: this mirrors `HomeComposer` + the `PromptInput` primitive, which
 * are outside this workstream's file ownership and so could not be refactored to
 * share a height token. If the composer's card padding, textarea min-height, or
 * action-row control sizes change, change them here too.
 */
function ComposerShape() {
  return (
    <div className="rounded-3xl bg-border p-[1px]">
      <div className="rounded-3xl bg-background p-2.5 shadow-lg">
        {/* Textarea box — the primitive's `px-3 py-3` around one line of text. */}
        <div className="px-3 py-3">
          {/* Width tracks the real "Ask a legal question" placeholder's measure
              at `text-base` / `md:text-lg`; only the HEIGHT is load-bearing. */}
          <div className="h-6 w-40 rounded-full bg-muted md:h-7 md:w-44" />
        </div>
        {/* Action row — plus, the two furniture chips, and the send button. */}
        <div className="flex items-center gap-2 px-2 pb-1">
          <div className="flex min-w-0 flex-1 items-center gap-1 py-0.5">
            <div className="size-9 shrink-0 rounded-full bg-muted" />
            <div className="h-8 w-24 shrink-0 rounded-full bg-muted" />
            <div className="h-8 w-28 shrink-0 rounded-full bg-muted" />
          </div>
          <div className="size-11 shrink-0 rounded-full bg-muted md:size-10" />
        </div>
      </div>
    </div>
  );
}
