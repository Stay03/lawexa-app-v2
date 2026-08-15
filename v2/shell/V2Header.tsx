'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, Menu, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import type { SessionUser } from '@/v2/runtime/session';
import { useBackTo } from '@/v2/runtime/back-to';
import {
  useCollabHeader,
  type CollabHeaderContext,
} from '@/v2/features/collab/shell/collab-header';
import { parseCollabRoute } from '@/v2/features/collab/shell/collab-route';
import {
  CollabHeaderBack,
  CollabHeaderRailToggle,
  CollabHeaderTitle,
} from '@/v2/features/collab/shell/CollabHeaderSlot';
import { LogoMark, LogoWordmark } from './Logo';
import { V2NotificationBell } from './V2NotificationBell';
import { V2HeaderMenu } from './V2HeaderMenu';
import { HomeTabs } from './HomeTabs';
import { homeTabForPath } from './home-tabs';
import { useHeaderContext } from './header-context';
import { pushedScreenFor, type PushedScreen } from './pushed-route';
import { useScreenContext } from './screen-context';

/**
 * V2Header — the top bar, deliberately UNCROWDED (a binding owner decision).
 * Three regions on a `1fr auto 1fr` grid so the middle is the TRUE visual centre
 * of the bar regardless of how wide the left/right clusters get (owner #29):
 *
 *  - LEFT (grid col 1): the nav/brand cluster.
 *    - Mobile (`md:hidden`): the hamburger (keeps `id="v2-nav-trigger"`, the
 *      focus-restore target for V2Drawer's `onCloseAutoFocus` — DO NOT CHANGE)
 *      plus the compact square LogoMark.
 *    - Desktop (`hidden md:*`): `SidebarTrigger` (slides the rail off-canvas), the
 *      wordmark ONLY while the rail is collapsed (the expanded rail already shows
 *      it), a separator, and a ROUTE-AWARE breadcrumb label (owner #43). The label
 *      is a quiet CATEGORY ("Home" / "Conversation"), never the specific title —
 *      the centre already carries that, so the left stays uncrowded and never
 *      duplicates it. Routes with no category hide the label + its separator.
 *  - CENTRE (grid col 2, auto): route-scoped (owner #43, option A). On the home
 *    (`/`, `/work`, `/study`) it is the `HomeTabs` product control (owner #34);
 *    on every other route it surfaces that route's published context — the title
 *    (+ a compact confidential badge), skeleton-first while it resolves. `HeaderCenter`
 *    cross-fades the two symmetrically. Equal `1fr` side columns keep it dead-centre;
 *    both clusters fit inside their track down to 320px.
 *
 * ── THE COLLAB ROUTE CONTEXT (phase-5 redesign) ────────────────────────────
 * Inside a space, a title is not enough: the reader has to know which SPACE
 * they are in and be able to get out of the channel and into its list. So
 * `v2/features/collab/shell/collab-header.ts` publishes a richer context and,
 * WHEN AND ONLY WHEN it is present, three things change — the mobile logo mark
 * becomes a back chevron, a channel-list toggle appears between `md:` and
 * `lg:`, and the centre carries the space crest with the channel name over the
 * space name BELOW `md:` only.
 *
 * THE CENTRE GOES EMPTY AT `md:` AND UP ON THESE ROUTES, deliberately: that is
 * where the channel screen's own `PlaceHeader` starts naming the channel and
 * its space directly under this bar, and printing the same name twice on one
 * screen is worse than printing it once. The generic `RouteContext` is not used
 * as a fallback there either — it would put the same title back.
 *
 * Everything else, on every other route, is untouched: no context, no swap,
 * byte-identical header.
 *  - RIGHT (grid col 3): exactly TWO controls (owner #28) — the notification bell
 *    (hidden for guests) and the overflow menu (`V2HeaderMenu`), which now owns
 *    the light/dark theme toggle. The bare theme button has left the bar.
 *
 * Visibility is CSS-driven (`md:` variants), not `useIsMobile()`, so the correct
 * bar paints before hydration with no flash.
 *
 * ── A SCREEN YOU PUSHED INTO WEARS A DIFFERENT BAR (phase 7) ───────────────
 * The owner's rule, taken from the Claude and ChatGPT phone apps: a top-level
 * screen has the hamburger and puts its title in the PAGE; a screen you pushed
 * into has a BACK ARROW and puts its title in the BAR. Never both controls,
 * never both titles.
 *
 * Which one this is comes from `pushed-route.ts`, off the pathname, for the
 * same reason `screenOwnsPhoneBar` does: a published signal answers a paint
 * late, and the reader sees the hamburger swap to a chevron and the title jump
 * from the page into the bar. So on a pushed screen:
 *
 *   - the hamburger is GONE (there is one way out of a pushed screen, and it is
 *     back), replaced in the same slot by the back control;
 *   - the LogoMark is gone with it: the phone needs an "up" more than a second
 *     brand mark, which is the trade the collab routes already made;
 *   - the centre carries the screen's title BELOW `md:` only, and the page
 *     carries it from `md:` up, so exactly one title is on screen at any width.
 *
 * A DOCUMENT screen (a case, a statute, a note) is the deliberate exception:
 * its masthead is the document's own first page, so the page keeps the title at
 * every width and the bar carries none. See `PushedTitle` in `pushed-route.ts`.
 */
export function V2Header({ user }: { user: SessionUser | null }) {
  const { setOpenMobile, state } = useSidebar();
  const pathname = usePathname();
  // CONSUMES the route context another feature PUBLISHES (header-context.ts): the
  // conversation screen sets {title, confidential} once its history resolves, and
  // may update the title later (async name generation). `title` is null until then.
  const { title, confidential } = useHeaderContext();
  // Present only inside a space (`/spaces/{uuid}`, `/channels/{uuid}`), where
  // the collab frame publishes it. `null` everywhere else, and every branch
  // below falls back to exactly what it did before.
  const collab = useCollabHeader();
  const signedIn = !!user;
  const railCollapsed = state === 'collapsed';

  // Every home ROUTE shows the tab control, not just the root — Work and Study are
  // their own paths now (see v2/shell/home-tabs.ts).
  const isHome = homeTabForPath(pathname ?? '') !== null;
  // Routes that EXPECT context show a title skeleton while it's null (skeleton-first)
  // instead of an empty centre. A route opts in when its title is LATE — fetched
  // rather than known — which is true of a conversation and of a case, and false
  // of `/cases` itself (a literal string, published on mount, so it simply
  // cross-fades in with no skeleton).
  const path = pathname ?? '';
  const isConversation = path.startsWith('/c/');
  const isCase = /^\/cases\/[^/]/.test(path);
  // A case no longer publishes a bar title at all (its masthead is its title —
  // see `pushed-route.ts`), so the only route left that expects one is a
  // conversation. A pushed screen answers this question for itself below.
  const expectsContext = isConversation;
  /**
   * ONE BAR ON A PHONE, DECIDED BY THE ADDRESS AND NOTHING ELSE.
   *
   * A channel screen carries its own bar below `md:` and this one stands down
   * (mobile overhaul, phase 3). That used to be a signal the collab frame
   * PUBLISHED once its channel query landed — which meant the answer arrived
   * two paints late, and the phone showed the shell's bar, then the screen's,
   * with the channel's name jumping between them. The owner filmed it: "double
   * skeleton, the title jumping from place to place".
   *
   * Which screen owns the bar is a fact about the ROUTE. `/channels/{uuid}`
   * always has a screen bar; `/spaces/{uuid}` never does. So it is read off the
   * pathname, synchronously, before any request — the same answer on the server
   * render, the first client paint and every paint after it.
   *
   * THE OTHER HALF OF THIS RULE LIVES IN `ChannelScreen`: on this route the
   * screen must paint a bar in EVERY state it can be in, refusals included,
   * because this one is no longer there to fall back on.
   */
  const collabRoute = parseCollabRoute(path);
  const screenOwnsPhoneBar = collabRoute.kind === 'channel';
  /**
   * IS THIS A SCREEN THE READER PUSHED INTO? Off the address, never a publish
   * (see the docblock). The collab routes are pushed too, and answer it from
   * the same place — the route, not the context, so the hamburger never paints
   * on `/spaces/{uuid}` before the crest arrives.
   */
  const pushed = pushedScreenFor(path);
  const isPushed = pushed !== null || collabRoute.kind !== 'none';
  // The two things a pushed screen's ADDRESS cannot know: a data-derived parent
  // and the screen's own menu rows. Guarded by the pathname it was published
  // for, so nothing here can outlive its screen.
  const screen = useScreenContext(path);
  const back = screen?.back ?? null;
  // Quiet orientation label for the left cluster — a category, NOT the title.
  const leftLabel = isHome
    ? 'Home'
    : isConversation
      ? 'Conversation'
      : isCase
        ? 'Case'
        : null;

  return (
    <div
      className={cn(
        // The notch strip is painted by whichever bar is showing. It used to
        // ride the shell's header ROW, which meant a stood-down bar would have
        // left a dead padded strip above the screen (the trap the dock already
        // documents for the bottom edge).
        'v2-safe-top grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3',
        // ONE BAR ON A PHONE. Inside a channel the screen paints its own, so
        // this one gets out of the way below `md:` — see `screenOwnsPhoneBar`
        // above. A CSS variant, never a viewport hook.
        screenOwnsPhoneBar && 'max-md:hidden',
      )}
    >
      {/* LEFT cluster. */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Mobile: hamburger opens the drawer — on a TOP-LEVEL screen only. A
            screen you pushed into has one way out and it is back; two controls
            in one slot is the "three ways back" this pass exists to remove.
            The id is the focus-restore target for V2Drawer's onCloseAutoFocus
            (no SheetTrigger exists), and the drawer falls back to the shell's
            content region on a route that has no hamburger. */}
        {isPushed ? null : (
          <Button
            id="v2-nav-trigger"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 rounded-full md:hidden"
            aria-label="Open menu"
            onClick={() => setOpenMobile(true)}
          >
            <Menu className="size-5" />
          </Button>
        )}

        {/* The way out, in the slot the hamburger used to hold.
            Three cases, in the order they are decided:
             - a pushed screen from the table: its own back control, at EVERY
               width (a desktop reader lost their only "up" when the body chips
               went, and the rail cannot say "back to THIS case");
             - a collab route: the collab slot's chevron once the place has
               resolved, and a route-derived one until then. Both are a chevron
               in the same box, so nothing moves; only the address sharpens, and
               on `/spaces/{uuid}` it is `/spaces` either way;
             - anything else: the compact brand mark, exactly as before. */}
        {pushed ? (
          <PushedBack screen={pushed} override={back} />
        ) : collabRoute.kind !== 'none' ? (
          collab ? (
            <CollabHeaderBack context={collab} />
          ) : (
            <CollabRouteBack />
          )
        ) : (
          <span className="flex shrink-0 items-center md:hidden">
            <LogoMark className="size-9" />
          </span>
        )}

        {/* Desktop: sidebar trigger + breadcrumb slot. The wordmark appears only
            while the rail is collapsed, so the brand never leaves the chrome and
            is never shown twice (reviewer finding). */}
        <SidebarTrigger className="-ml-1 hidden shrink-0 md:inline-flex" />
        {/* The channel-list toggle for the band where the space rail is not
            docked yet but the phone's centre cluster has already gone. */}
        {collab ? <CollabHeaderRailToggle context={collab} /> : null}
        {railCollapsed ? (
          <span className="hidden shrink-0 items-center md:flex">
            <LogoWordmark className="h-9" />
          </span>
        ) : null}
        {leftLabel ? (
          <>
            <Separator
              orientation="vertical"
              className="mr-1 hidden h-4 md:block"
            />
            <span className="hidden truncate text-sm text-muted-foreground md:inline">
              {leftLabel}
            </span>
          </>
        ) : null}
      </div>

      {/* CENTRE — home tabs on `/`, route context elsewhere (owner #43). */}
      <HeaderCenter
        isHome={isHome}
        pushed={pushed}
        expectsContext={expectsContext}
        title={title}
        confidential={confidential}
        collab={collab}
      />

      {/* RIGHT cluster — bell + overflow menu (owner #28). Uncrowded by decree. */}
      <div className="flex min-w-0 items-center justify-end gap-1">
        <V2NotificationBell signedIn={signedIn} />
        <V2HeaderMenu />
      </div>
    </div>
  );
}

/**
 * PushedBack — the one way out of a screen you pushed into.
 *
 * It is a `<Link>` and stays one: `useBackTo` keeps the real address (so
 * middle-click, long-press preview and a screen reader all still work) and
 * takes the history move ONLY when the parent really is the screen behind. A
 * reader who arrived from a notification with nothing behind them gets the push
 * they have always had, never a jump out of the app.
 *
 * The `override` is the screen's own answer where the address cannot have one
 * (a nested folder's parent, a draft note's stream). Address and label move
 * together, always: a control whose label disagrees with where it goes is the
 * bug this pass was sent to fix on `/spaces/{uuid}`.
 */
function PushedBack({
  screen,
  override,
}: {
  screen: PushedScreen;
  override: { href: string; label: string } | null;
}) {
  const back = useBackTo(override?.href ?? screen.backHref);
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="size-11 shrink-0 rounded-full text-muted-foreground md:size-9"
    >
      <Link {...back} aria-label={override?.label ?? screen.backLabel}>
        <ChevronLeft aria-hidden className="size-5" />
      </Link>
    </Button>
  );
}

/**
 * The collab routes' back control BEFORE their context has been published.
 *
 * The frame publishes a richer answer a moment later (a thread's parent
 * channel, the space a channel belongs to) and `CollabHeaderBack` replaces this
 * with it. Until then the only place this bar can honestly promise is the
 * spaces list, which is also the FINAL answer on `/spaces/{uuid}` — so on the
 * one route where a phone can see this, the address never changes at all.
 *
 * It exists because the alternative was worse: the slot used to fall back to
 * the brand mark, so a cold landing in a space painted a logo where the way out
 * belongs and then swapped it for a chevron.
 */
function CollabRouteBack() {
  const back = useBackTo('/spaces');
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 rounded-full text-muted-foreground lg:hidden"
    >
      <Link {...back} aria-label="Back to your spaces">
        <ChevronLeft aria-hidden className="size-5" />
      </Link>
    </Button>
  );
}

/**
 * HeaderCenter — the bar's centre slot. Home (`/`) shows the Chat|Work|Study tabs;
 * every other route shows its published context (owner #43). Both live as two
 * layers GRID-STACKED in one cell (`col/row-start-1`), so the swap is a pure
 * opacity CROSS-FADE — inherently symmetric in both directions, with no
 * orchestration (no setState-in-effect) and no keyed enter-only remount (owner
 * #24). Stacking (not `position:absolute`) keeps both layers in flow, so the cell
 * holds a stable width and nothing jumps. The inactive layer is `inert`, so the
 * hidden HomeTabs never sits in the tab order / a11y tree while a conversation is
 * open (and the hidden context never does on home). `motion-reduce` disables the
 * fade; the swap is then instant but still correct.
 *
 * On a PUSHED screen the centre is answered by the route table instead, and only
 * below `md:` — see {@link PushedCentre}.
 */
function HeaderCenter({
  isHome,
  pushed,
  expectsContext,
  title,
  confidential,
  collab,
}: {
  isHome: boolean;
  /** Non-null on a screen the reader pushed into (`pushed-route.ts`). */
  pushed: PushedScreen | null;
  expectsContext: boolean;
  title: string | null;
  confidential: boolean;
  /** Inside a space the centre carries the place, not just the title. */
  collab: CollabHeaderContext | null;
}) {
  return (
    <div className="grid min-w-0 place-items-center">
      <div
        data-active={isHome}
        inert={!isHome || undefined}
        className="col-start-1 row-start-1 transition-opacity duration-200 motion-reduce:transition-none data-[active=false]:pointer-events-none data-[active=false]:opacity-0"
      >
        <HomeTabs />
      </div>
      <div
        data-active={!isHome}
        inert={isHome || undefined}
        className="col-start-1 row-start-1 transition-opacity duration-200 motion-reduce:transition-none data-[active=false]:pointer-events-none data-[active=false]:opacity-0"
      >
        {isHome ? null : collab ? (
          <CollabHeaderTitle context={collab} />
        ) : pushed ? (
          <PushedCentre pushed={pushed} title={title} />
        ) : (
          <RouteContext
            title={title}
            confidential={confidential}
            expectsContext={expectsContext}
          />
        )}
      </div>
    </div>
  );
}

/**
 * PushedCentre — what a pushed screen's bar says, and at which widths.
 *
 * BELOW `md:` ONLY. From `md:` up the page shows its own heading and this goes
 * `display:none`, which takes it out of the accessibility tree with the pixels,
 * so the reader meets exactly one title at every width. That is the same
 * contract the channel screen already runs on, applied to the rest of the
 * product.
 *
 * A document screen (`kind: 'none'`) renders nothing at any width: its masthead
 * IS its title. Rendering nothing here rather than an empty box keeps the
 * centre column at zero width, so the back control and the right cluster sit
 * where a two-item bar should put them.
 */
function PushedCentre({
  pushed,
  title,
}: {
  pushed: PushedScreen;
  /** The published route title — read only when the screen asked for it. */
  title: string | null;
}) {
  const slot = pushed.title;
  if (slot.kind === 'none') return null;
  return (
    <div className="md:hidden">
      <RouteContext
        title={slot.kind === 'fixed' ? slot.text : title}
        confidential={false}
        // A fixed title is known before the first paint and never shimmers; a
        // published one is genuinely late, so it gets the title-shaped skeleton
        // rather than an empty centre that pops.
        expectsContext={slot.kind === 'published'}
      />
    </div>
  );
}

/**
 * RouteContext — the non-home centre payload: the published route title, with a
 * quiet title-shaped shimmer while it is still null on a context-expecting route
 * (skeleton-first — never empty-then-pop, never a placeholder string), and a
 * compact confidential badge when flagged. Skeleton and title are grid-stacked in
 * a FIXED-width box, so the null→title resolve is a jank-free opacity cross-fade
 * (the box never changes width) and the title truncates rather than shoving the
 * side clusters. A later title→title update (async name generation) swaps in place
 * inside that stable, truncating box — no layout shift. Widths step up per
 * breakpoint and stay inside the 320px centre budget the HomeTabs docblock reserves.
 */
function RouteContext({
  title,
  confidential,
  expectsContext,
}: {
  title: string | null;
  confidential: boolean;
  expectsContext: boolean;
}) {
  const showTitle = title !== null;
  const showSkeleton = !showTitle && expectsContext;
  const hasContent = showTitle || showSkeleton;

  return (
    <div
      className={cn(
        'grid place-items-center',
        hasContent ? 'w-24 min-[400px]:w-44 sm:w-60 md:w-72' : 'w-0',
      )}
    >
      {/* Title-shaped shimmer (skeleton-first). */}
      <div
        aria-hidden
        data-active={showSkeleton}
        className="col-start-1 row-start-1 w-full transition-opacity duration-200 motion-reduce:transition-none data-[active=false]:opacity-0"
      >
        <div className="mx-auto h-4 w-3/4 animate-pulse rounded-full bg-muted" />
      </div>
      {/* Resolved title + optional confidential badge. */}
      <div
        data-active={showTitle}
        className="col-start-1 row-start-1 flex w-full min-w-0 items-center justify-center transition-opacity duration-200 motion-reduce:transition-none data-[active=false]:opacity-0"
      >
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {title}
        </span>
        <ConfidentialBadge on={confidential} />
      </div>
    </div>
  );
}

/**
 * ConfidentialBadge — a compact emerald ShieldCheck marker, the header-scale echo
 * of the conversation surface's confidential language (ConversationScreen uses the
 * same ShieldCheck + emerald-500/emerald-700/400 palette), legible in both themes.
 * It expands + opacity-fades in and out SYMMETRICALLY (owner #24), so flagging (or
 * clearing) confidential is never an abrupt pop; collapsed it reserves no width and
 * is removed from the a11y tree (`aria-hidden`).
 */
function ConfidentialBadge({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden={!on}
      className={cn(
        'inline-flex shrink-0 items-center overflow-hidden transition-[max-width,opacity,margin] duration-200 motion-reduce:transition-none',
        on ? 'ml-1.5 max-w-6 opacity-100' : 'ml-0 max-w-0 opacity-0',
      )}
    >
      <span
        title="Confidential"
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      >
        <ShieldCheck className="size-3" aria-hidden />
        <span className="sr-only">Confidential</span>
      </span>
    </span>
  );
}
