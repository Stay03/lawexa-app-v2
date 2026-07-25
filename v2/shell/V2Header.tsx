'use client';

import { usePathname } from 'next/navigation';
import { Menu, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import type { SessionUser } from '@/v2/runtime/session';
import { LogoMark, LogoWordmark } from './Logo';
import { V2NotificationBell } from './V2NotificationBell';
import { V2HeaderMenu } from './V2HeaderMenu';
import { HomeTabs } from './HomeTabs';
import { homeTabForPath } from './home-tabs';
import { useHeaderContext } from './header-context';

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
 *  - RIGHT (grid col 3): exactly TWO controls (owner #28) — the notification bell
 *    (hidden for guests) and the overflow menu (`V2HeaderMenu`), which now owns
 *    the light/dark theme toggle. The bare theme button has left the bar.
 *
 * Visibility is CSS-driven (`md:` variants), not `useIsMobile()`, so the correct
 * bar paints before hydration with no flash.
 */
export function V2Header({ user }: { user: SessionUser | null }) {
  const { setOpenMobile, state } = useSidebar();
  const pathname = usePathname();
  // CONSUMES the route context another feature PUBLISHES (header-context.ts): the
  // conversation screen sets {title, confidential} once its history resolves, and
  // may update the title later (async name generation). `title` is null until then.
  const { title, confidential } = useHeaderContext();
  const signedIn = !!user;
  const railCollapsed = state === 'collapsed';

  // Every home ROUTE shows the tab control, not just the root — Work and Study are
  // their own paths now (see v2/shell/home-tabs.ts).
  const isHome = homeTabForPath(pathname ?? '') !== null;
  // Routes that EXPECT context show a title skeleton while it's null (skeleton-first)
  // instead of an empty centre. Mirrors Dock.tsx's conversation-route test; kept
  // generic so a future route can opt in the same way.
  const expectsContext = pathname?.startsWith('/c/') ?? false;
  // Quiet orientation label for the left cluster — a category, NOT the title.
  const leftLabel = isHome ? 'Home' : expectsContext ? 'Conversation' : null;

  return (
    <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
      {/* LEFT cluster. */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Mobile: hamburger opens the drawer. The id is the focus-restore target
            for V2Drawer's onCloseAutoFocus (no SheetTrigger exists). */}
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
        <span className="flex shrink-0 items-center md:hidden">
          <LogoMark className="size-9" />
        </span>

        {/* Desktop: sidebar trigger + breadcrumb slot. The wordmark appears only
            while the rail is collapsed, so the brand never leaves the chrome and
            is never shown twice (reviewer finding). */}
        <SidebarTrigger className="-ml-1 hidden shrink-0 md:inline-flex" />
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
        expectsContext={expectsContext}
        title={title}
        confidential={confidential}
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
 */
function HeaderCenter({
  isHome,
  expectsContext,
  title,
  confidential,
}: {
  isHome: boolean;
  expectsContext: boolean;
  title: string | null;
  confidential: boolean;
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
        {isHome ? null : (
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
