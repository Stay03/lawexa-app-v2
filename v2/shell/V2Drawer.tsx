'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight, MessageSquare, Search, X } from 'lucide-react';

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
import { conversationsQueries } from '@/v2/features/conversations/queries';
import type { SessionUser } from '@/v2/runtime/session';
import { LogoWordmark } from './Logo';
import { V2UserFooter } from './V2UserFooter';
import { v2NavItems, v2NewChat, type V2NavItem } from './nav.config';

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
 * Reuses `components/ui/sheet` (a Radix Dialog): scrim, Esc / scrim close, focus
 * trap, and the 200ms `side="left"` slide for free. The pinned footer is a flex
 * column with the scroll region taking `flex-1`. Bound to the sidebar context's
 * `openMobile`; on mobile `V2Sidebar` renders `null`, so this is the sole consumer
 * of that state.
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
  onNavigate: () => void;
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
                onClick={onNavigate}
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
  const signedIn = !!user;
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

  const close = () => setOpenMobile(false);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const NewChatIcon = v2NewChat.icon;
  const recents = recentsQuery.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <Sheet open={openMobile} onOpenChange={setOpenMobile}>
      <SheetContent
        side="left"
        showCloseButton={false}
        // Variant-matched overrides: the Sheet primitive sets its width via
        // `data-[side=left]:w-3/4` + `data-[side=left]:sm:max-w-sm`, which beat
        // unprefixed utilities on specificity — so the overrides must carry the
        // same variant prefix or they're dead classes (reviewer finding).
        className="gap-0 p-0 data-[side=left]:w-[min(85%,360px)] data-[side=left]:max-w-none data-[side=left]:sm:max-w-none"
        // The drawer is opened by the external hamburger (no SheetTrigger), so
        // Radix has no trigger to restore focus to on close — without this,
        // focus lands on <body> and keyboard/AT users lose their place.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById('v2-nav-trigger')?.focus();
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
            onClick={close}
            aria-label="Lawexa home"
            className="inline-flex items-center rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogoWordmark className="h-10 w-auto" />
          </Link>
          <span className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="size-11 rounded-full text-muted-foreground"
            aria-label="Search"
          >
            <Search className="size-5" />
          </Button>
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
              onClick={close}
              className={cn(ROW_BASE, 'font-medium text-primary hover:bg-muted')}
            >
              {NewChatIcon ? <NewChatIcon className="size-5 shrink-0" /> : null}
              <span className="truncate">{v2NewChat.label}</span>
            </Link>

            {v2NavItems.map((item) => {
              // Expandable group (Library) — a collapsible matching the rail
              // (owner #42): toggle row + chevron + animated height both ways.
              if (item.items && item.items.length > 0) {
                return (
                  <DrawerNavGroup
                    key={item.label}
                    item={item}
                    isActive={isActive}
                    onNavigate={close}
                  />
                );
              }

              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={close}
                  className={cn(
                    ROW_BASE,
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  {Icon ? <Icon className="size-5 shrink-0" /> : null}
                  <span className="truncate">{item.label}</span>
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
                      <Link
                        key={conversation.id}
                        href={`/c/${conversation.id}`}
                        onClick={close}
                        className={cn(
                          ROW_BASE,
                          'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
                          active
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <MessageSquare className="size-4 shrink-0" />
                        <span className="truncate">{title}</span>
                      </Link>
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
          <V2UserFooter user={user} />
          <SwitchBackButton />
        </div>
      </SheetContent>
    </Sheet>
  );
}
