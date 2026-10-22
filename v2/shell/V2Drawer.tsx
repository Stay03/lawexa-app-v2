'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight, MessageSquare, X } from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useInfiniteScrollSentinel } from './use-infinite-scroll';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useSidebar } from '@/components/ui/sidebar';
import { SwitchBackButton } from '@/app/v2/switch-back-button';
import {
  NavSignalMark,
  QUIET_NAV_SIGNAL,
  useCollabNavSignal,
} from '@/v2/features/channels/my-channels/nav-signal';
import { uniqueRowsById } from '@/v2/features/conversations/activity';
import { useFreshIds } from '@/v2/runtime/use-fresh-ids';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import type { SessionUser } from '@/v2/runtime/session';
import { LogoWordmark } from './Logo';
import { V2UserFooter } from './V2UserFooter';
import {
  isNavItemActive,
  v2NewChat,
  visibleNavItems,
  type V2NavItem,
} from './nav.config';
import { V2_SHELL_CONTENT_ID } from './shell-content';
import { MoveFirstLink, useShownPathname } from './move-first';
import { RecentChatLabel, recentSpaceName } from './recent-chat-label';
import { isAccountRole } from '@/v2/runtime/account';
import {
  DRAWER_CLOSE_CAP_MS,
  afterPaint,
  drawerCloseStep,
  type ArmedDrawerClose,
} from './drawer-close';

/**
 * V2Drawer — the mobile navigation drawer (Nav D, locked). ChatGPT-style
 * slide-in left panel: a seamless header, ONE scroll region holding the nav rows
 * (New chat first) then the Recents list (they scroll away together), and a
 * pinned footer with the real account row + the preview exit.
 *
 * DESIGN PASS (owner #22): the h-10 wordmark (#5), a consistent 44px row rhythm
 * with calm hover/active tints that fade rather than snap (owner rule #17 —
 * `transition-colors` everywhere), a quiet uppercase Recents label, and a footer
 * set off by a hairline over the scrolling content.
 *
 * Reuses `components/ui/sheet` (a Radix Dialog): scrim, Esc / scrim close and
 * the focus trap. THE SLIDE IS ITS OWN (Stay, 22 October 2026: "The left
 * sidebar doesn't feel very smooth when opening and closing I need a smooth,
 * satisfying motion"): the stock sheet nudges 40px under a fade and its scrim
 * fades on a separate, shorter clock. `.v2-drawer` on the panel and
 * `.v2-drawer-scrim` on the overlay carry the drawer's motion in shell.css,
 * the whole width in, 280 ms out of the edge and 220 ms back into it, the
 * scrim on the same clock. The pinned footer is a flex column with the scroll
 * region taking `flex-1`. Bound to the sidebar context's `openMobile`; on
 * mobile `V2Sidebar` renders `null`, so this is the sole consumer of that
 * state.
 *
 * A ROW CLOSES IT AFTER THE PAGE IT OPENS IS UP (Stay, the same day: "when I
 * select an option from the sidebar and it's taking me to the page the
 * sidebar closes weird"). Every row used to close it in the click that
 * started the route change, so the exit stalled under the new screen's
 * commit and cut. Now a row for another page arms a close (`closeFor`) and
 * the drawer leaves once the shown path has changed and a frame has painted,
 * or at a 600 ms cap; a row for the shown page closes it at once. The
 * decision is `drawer-close.ts`. The chat rows no longer take the move-first
 * cut: the drawer slides away over the chat's frame instead.
 */

/** New-chat + primary nav share this base row shape so the drawer reads uniform. */
const ROW_BASE =
  'flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors';

/**
 * Drawer counterpart of the sidebar's Library group (owner #42 — "sidebar +
 * drawer"). Same interaction grammar as the rail: the top row is a TOGGLE, not a
 * nav link (on the rail Library only expands; the children are the destinations),
 * carries a chevron that rotates, holds the 44px `ROW_BASE` rhythm, and animates
 * its height BOTH directions with `.v2-collapse` (shell.css) — attached only after
 * the first user toggle (event-handler flag) so the `defaultOpen` first paint
 * stays still (the shell.css caveat), matching the sidebar exactly.
 *
 * Open state is UNCONTROLLED (`defaultOpen`), like the rail. The Sheet remounts on
 * each open, so the drawer always reopens expanded — the right default for a
 * transient overlay (nothing to remember between openings), and consistent with
 * v1, whose Library was permanently open.
 */
function DrawerNavGroup({
  item,
  isActive,
  onNavigate,
}: {
  item: V2NavItem;
  isActive: (href: string) => boolean;
  /** The drawer's close for a child row, handed where the row goes. */
  onNavigate: (href: string) => void;
}) {
  const [hasToggled, setHasToggled] = useState(false);
  const Icon = item.icon;

  return (
    <Collapsible
      defaultOpen
      onOpenChange={() => setHasToggled(true)}
      className="group/collapsible"
    >
      <CollapsibleTrigger
        className={cn(ROW_BASE, 'w-full text-foreground hover:bg-muted')}
      >
        {Icon ? <Icon className="size-5 shrink-0" /> : null}
        <span className="truncate">{item.label}</span>
        <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none" />
      </CollapsibleTrigger>
      {/* `.v2-collapse` animates height both directions, post-first-toggle only. */}
      <CollapsibleContent className={cn(hasToggled && 'v2-collapse')}>
        <div className="mb-1 ml-[1.375rem] mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
          {item.items?.map((sub) => {
            const subActive = isActive(sub.href);
            return (
              <Link
                key={sub.label}
                href={sub.href}
                onClick={() => onNavigate(sub.href)}
                className={cn(
                  'flex h-10 items-center rounded-lg px-3 text-sm transition-colors',
                  subActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="truncate">{sub.label}</span>
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function V2Drawer({ user }: { user: SessionUser | null }) {
  const { openMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  // What is on screen: the tap's destination while a move-first frame shows,
  // else the router's pathname (move-first.tsx). A row's close keys on it.
  const shown = useShownPathname();
  // Recents belong to an account; a guest pass has none (v2/runtime/account.ts).
  const signedIn = !!user && isAccountRole(user.role);
  // The cache PARTITION for the recents key (see `ViewerScoped`). Taken from the
  // SERVER-verified user the layout already threads in here — no hook needed, and
  // it is the same id `V2SessionProvider` publishes.
  const viewerId = user?.id ?? null;

  // The single overflow-y-auto region below is the drawer's scroll root — the
  // infinite sentinel measures its prefetch margin against THIS element.
  const scrollRef = useRef<HTMLDivElement>(null);

  const recentsQuery = useInfiniteQuery({
    ...conversationsQueries.infiniteRecents({ viewerId }),
    enabled: signedIn,
  });
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: recentsQuery.hasNextPage,
    isFetchingNextPage: recentsQuery.isFetchingNextPage,
    fetchNextPage: recentsQuery.fetchNextPage,
    rootRef: scrollRef,
  });

  // A tap on a row for another page is held here until that page is up, with
  // the cap's timer (drawer-close.ts). Refs, not state: arming must not
  // re-render the drawer in the click, which is the task the destination's
  // first frame paints in.
  const armedRef = useRef<ArmedDrawerClose | null>(null);
  const capRef = useRef(0);

  const disarm = () => {
    window.clearTimeout(capRef.current);
    capRef.current = 0;
    armedRef.current = null;
  };
  const close = () => {
    disarm();
    setOpenMobile(false);
  };
  /** A row's tap. The shown page closes the drawer at once; another page
   *  keeps it open until that page has painted, or until the cap. */
  const closeFor = (href: string) => {
    if (drawerCloseStep(armedRef.current, { kind: 'tap', href, pathname: shown }) === 'close') {
      close();
      return;
    }
    disarm();
    armedRef.current = { from: shown };
    capRef.current = window.setTimeout(() => {
      if (drawerCloseStep(armedRef.current, { kind: 'cap' }) === 'close') close();
    }, DRAWER_CLOSE_CAP_MS);
  };
  // The destination is up: close after one more painted frame, so the drawer
  // slides away over a screen that is already drawn. An Effect Event, so the
  // effect keys on the shown path alone (the shape of move-first's onPopState).
  const leave = useEffectEvent(close);
  useEffect(() => {
    if (drawerCloseStep(armedRef.current, { kind: 'shown', pathname: shown }) !== 'close-after-paint') return;
    return afterPaint(() => leave());
  }, [shown]);
  // The cap's timer does not outlive the drawer: a footer row to a v1 page
  // unmounts the whole v2 shell before the cap.
  const dropCap = useEffectEvent(disarm);
  useEffect(() => () => dropCap(), []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const NewChatIcon = v2NewChat.icon;
  // Each chat once: a bump can move a row a later page still holds (activity.ts).
  const recents = uniqueRowsById(recentsQuery.data?.pages.flatMap((page) => page.data) ?? []);
  // Only a chat the list has not shown fades in: a chat moving to the top must
  // not replay the rows it passed (use-fresh-ids.ts).
  const freshIds = useFreshIds(recents.map((row) => row.id));
  // Same filter, same source, same server-verified role as the rail — see
  // `visibleNavItems`. The two surfaces cannot drift on what exists.
  const navItems = visibleNavItems({
    role: user?.role ?? null,
    canAccessTeamChannels: user?.can_access_team_channels ?? false,
  });
  // The Channels row's live unread signal. Read UNCONDITIONALLY (a hook may
  // not be called behind a branch) and off the cache entry the realtime spine
  // already mounts, so it costs an observer and never a request; it resolves
  // to the quiet value for anyone the collab gate would refuse.
  const collabSignal = useCollabNavSignal();

  return (
    // A scrim tap or Esc closes through `close`, so an armed row's close is
    // dropped with the drawer and cannot fire on the next open.
    <Sheet open={openMobile} onOpenChange={(open) => (open ? setOpenMobile(true) : close())}>
      <SheetContent
        side="left"
        showCloseButton={false}
        // Variant-matched overrides: the Sheet primitive sets its width via
        // `data-[side=left]:w-3/4` + `data-[side=left]:sm:max-w-sm`, which beat
        // unprefixed utilities on specificity — so the overrides must carry the
        // same variant prefix or they're dead classes (reviewer finding).
        // `v2-drawer` and `v2-drawer-scrim` are the drawer's motion (shell.css):
        // unlayered rules on these two elements alone, so every other sheet
        // keeps the stock motion.
        className="v2-drawer gap-0 p-0 data-[side=left]:w-[min(85%,360px)] data-[side=left]:max-w-none data-[side=left]:sm:max-w-none"
        overlayClassName="v2-drawer-scrim"
        // The drawer is opened by the external hamburger (no SheetTrigger), so
        // Radix has no trigger to restore focus to on close — without this,
        // focus lands on <body> and keyboard/AT users lose their place.
        //
        // THE HAMBURGER IS NOT ALWAYS THERE ANY MORE. Tapping a nav row closes
        // this drawer and navigates, and a screen you pushed into wears a back
        // arrow instead (`pushed-route.ts`), so the trigger the reader opened
        // this with can be gone by the time it closes. The shell's content
        // region is the honest second choice: it is already `tabIndex={-1}`
        // for exactly this kind of hand-off, and it puts the reader at the top
        // of what they just navigated to rather than on <body>.
        //
        // `preventScroll`: a plain focus() may scroll the document to reveal its
        // target, and the locked document must never move. iOS then hit-tests
        // the next sheet against that offset, one row above the finger (Arthur's
        // iPhone, 10 October 2026). Radix's own focus moves already pass it.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target =
            document.getElementById('v2-nav-trigger') ??
            document.getElementById(V2_SHELL_CONTENT_ID);
          target?.focus({ preventScroll: true });
        }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>
            Primary navigation, recent conversations, and account controls.
          </SheetDescription>
        </SheetHeader>

        {/* Seamless header: wordmark + search + close (no divider). */}
        <div className="v2-safe-top flex h-16 shrink-0 items-center gap-1 px-3">
          <Link
            href={v2NewChat.href}
            onClick={() => closeFor(v2NewChat.href)}
            aria-label="Lawexa home"
            className="inline-flex items-center rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogoWordmark className="h-10 w-auto" />
          </Link>
          <span className="flex-1" />
          {/* A Search button lived here with NO handler — a control that looked
              live, took a tap, and did nothing. Removed rather than wired: this
              drawer does not own search, and inventing a destination for it
              here would be guessing at a surface another part of the shell is
              responsible for. An absent control is honest; a dead one is not. */}
          <Button
            variant="ghost"
            size="icon"
            className="size-11 rounded-full text-muted-foreground"
            aria-label="Close menu"
            onClick={close}
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* ONE scroll region: New chat, nav rows, then Recents. */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
        >
          <nav aria-label="Primary" className="flex flex-col gap-0.5">
            {/* New chat — a standard nav row (owner #9): identical shape/hover to
                every other row; only the label + icon carry the theme gold. */}
            <Link
              href={v2NewChat.href}
              onClick={() => closeFor(v2NewChat.href)}
              className={cn(ROW_BASE, 'font-medium text-primary hover:bg-muted')}
            >
              {NewChatIcon ? <NewChatIcon className="size-5 shrink-0" /> : null}
              <span className="truncate">{v2NewChat.label}</span>
            </Link>

            {navItems.map((item) => {
              // Expandable group (Library) — a collapsible matching the rail
              // (owner #42): toggle row + chevron + animated height both ways.
              if (item.items && item.items.length > 0) {
                return (
                  <DrawerNavGroup
                    key={item.label}
                    item={item}
                    isActive={isActive}
                    onNavigate={closeFor}
                  />
                );
              }

              const Icon = item.icon;
              const active = isNavItemActive(item, isActive);
              // The unread grammar on the nav row: bold + gold dot = unread, a
              // number is ONLY ever mentions, no red. The label bolds here and
              // the mark renders in the trailing slot.
              const signal = item.signalId ? collabSignal : QUIET_NAV_SIGNAL;
              const alerting = signal.unread || signal.mentions > 0;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => closeFor(item.href)}
                  className={cn(
                    ROW_BASE,
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-foreground hover:bg-muted',
                    !active && alerting && 'font-semibold',
                  )}
                >
                  {Icon ? <Icon className="size-5 shrink-0" /> : null}
                  <span className="truncate">{item.label}</span>
                  <NavSignalMark signal={signal} className="ml-auto" />
                </Link>
              );
            })}
          </nav>

          {/* Recents — real conversations (read-only). Hidden for guests. */}
          {signedIn ? (
            <>
              <p className="px-3 pb-1 pt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Recent
              </p>
              <div className="flex flex-col gap-0.5">
                {recentsQuery.isPending ? (
                  [0.9, 0.65, 0.4].map((opacity, index) => (
                    <div
                      key={index}
                      className="flex h-11 items-center gap-3 px-3"
                      style={{ opacity }}
                    >
                      <div className="size-4 shrink-0 animate-pulse rounded bg-muted" />
                      <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
                    </div>
                  ))
                ) : recentsQuery.isError ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Couldn&apos;t load conversations
                  </p>
                ) : recents.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No conversations yet
                  </p>
                ) : (
                  recents.map((conversation) => {
                    const title = stripPastedTags(conversation.title);
                    const active = isActive(`/c/${conversation.id}`);
                    return (
                      <MoveFirstLink
                        key={conversation.id}
                        href={`/c/${conversation.id}`}
                        kind="conversation"
                        title={title}
                        header={{ title: title || null, confidential: Boolean(conversation.is_confidential) }}
                        headerOwner={conversation.id}
                        // No `onMove`: that would cut the drawer in the tap's
                        // frame (move-first.tsx). The tap only arms a close,
                        // and the drawer slides away once the chat's frame is
                        // up, so the click task stays as light as a list tap's.
                        onClick={() => closeFor(`/c/${conversation.id}`)}
                        className={cn(
                          ROW_BASE,
                          freshIds.has(conversation.id) &&
                            'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
                          active
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <MessageSquare className="size-4 shrink-0" />
                        <RecentChatLabel title={title} spaceName={recentSpaceName(conversation)} />
                      </MoveFirstLink>
                    );
                  })
                )}

                {/* Infinite sentinel (owner #26): present while more pages exist;
                    scrolling it into the drawer's view loads the next page, with a
                    skeleton row while that page is in flight (skeleton-first). */}
                {recentsQuery.hasNextPage ? (
                  <div ref={sentinelRef} aria-hidden className="px-3 py-1">
                    {recentsQuery.isFetchingNextPage ? (
                      <div className="flex h-9 items-center gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                        <div className="size-4 shrink-0 animate-pulse rounded bg-muted" />
                        <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {/* Pinned footer: real account row + preview exit (no gold pill). A
            hairline sets it off from the scroll region — this is a pinned bar over
            scrolling content, not a chrome edge. */}
        <div className="v2-safe-bottom flex shrink-0 flex-col gap-2 border-t border-border p-3">
          <V2UserFooter user={user} onNavigate={closeFor} />
          <SwitchBackButton />
        </div>
      </SheetContent>
    </Sheet>
  );
}
