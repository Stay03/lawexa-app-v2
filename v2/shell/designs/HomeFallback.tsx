'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { HomeTab } from '@/v2/shell/home-tabs';
import { HomePrompts } from './HomePrompts';
import { HomeQuickJump } from './HomeQuickJump';
import { HomeSection, HomeSectionSkeleton } from './sections/HomeSection';
import {
  CHAT_COMPOSER_DOCK,
  HOME_SECTIONS,
  CHAT_PROMPTS,
  DOCK_FADE,
  HOME_GREETING_SKELETON_HEADING,
  HOME_GREETING_SKELETON_SUBLINE,
  HOME_SURFACE_FOCUSED,
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
 *  • THE SECTION STACK gets real headings over STILL `HomeSectionSkeleton` rows (a pulse promises a request; this boundary waits on an RSC payload, and the section queries beneath it are often already warm) —
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

export function HomeFallback({ tab }: { tab: HomeTab }) {

  return (
    <>
      <span role="status" className="sr-only">
        Loading your home
      </span>
      <div aria-hidden inert className="h-full">
        {tab === 'chat' ? <ChatFrame /> : <TabFrame tab={tab} />}
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
 * There is no ambient spotlight to reproduce. The Chat surface used to carry one;
 * the owner removed it outright on July 25, so neither this fallback nor the real
 * surface draws any decorative light.
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
        <PromptsBlock tab="chat" />
      </div>
    </div>
  );
}

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

/**
 * The Work / Study frame — the SAME focused column the real surfaces now use.
 *
 * The old two-column workspace frame and its two hand-built rails are gone with
 * the rail itself. What is left is the shared shape plus the tab's own section
 * headings, which is all these tabs are.
 *
 * WHY THE HEADINGS ARE REAL TEXT AND THE ROWS ARE SKELETONS. A heading is static
 * chrome — "Jump back in" is a literal, known before any request — so drawing it
 * still and solid is honest and makes the hand-off to the real section change
 * nothing but the rows. The rows genuinely are waiting on data, so they pulse.
 * That is standards §8 applied per element rather than per block.
 *
 * `still` on every skeleton: this fallback waits on an RSC payload, not on the
 * API, and the queries behind the real sections are frequently already warm.
 * Pulsing here would animate over data we already hold.
 *
 * `prefetch: false` on every heading action is load-bearing, not cosmetic:
 * `next/link` prefetches by default through a callback ref + shared
 * IntersectionObserver, and `inert` stops focus, clicks and pointer events but NOT
 * refs, observers or network. Without it this about-to-be-deleted subtree fires
 * real RSC prefetches — invisible in dev, where prefetching is off, and live in
 * production.
 *
 * ROLE-GATED SECTIONS ARE NOT DRAWN. The fallback has no session, and reserving a
 * panel that half the audience never sees trades one settle for a worse one — so
 * "Jump back in" (spaces-gated) and the student-gated study-mode row are omitted,
 * exactly as the old frame omitted their boxed ancestors.
 */
function TabFrame({ tab }: { tab: Exclude<HomeTab, 'chat'> }) {
  return (
    <div className={HOME_SURFACE_FOCUSED}>
      <GreetingSkeleton align="center" subline />

      <div className={CHAT_COMPOSER_DOCK}>
        <div className={DOCK_FADE} />
        <ComposerShape />
      </div>

      <div className={CHAT_PROMPTS}>
        <PromptsBlock tab={tab} />
      </div>

      <div className={HOME_SECTIONS}>
        <HomeSection
          title="Recent conversations"
          action={{ href: '/conversations', label: 'All', prefetch: false }}
        >
          <HomeSectionSkeleton still />
        </HomeSection>
        {tab === 'study' ? (
          <HomeSection title="Recently viewed">
            <HomeSectionSkeleton still />
          </HomeSection>
        ) : null}
      </div>
    </div>
  );
}

function PromptsBlock({ tab }: { tab: HomeTab }) {
  return (
    <>
      <div className="md:hidden">
        <HomePrompts variant="mobile" tab={tab} onSelect={NOOP} />
      </div>
      <div className="hidden md:block">
        <HomePrompts variant="desktop" tab={tab} onSelect={NOOP} />
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
