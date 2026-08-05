'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight, MessageSquare } from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useInfiniteScrollSentinel } from './use-infinite-scroll';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { SwitchBackButton } from '@/app/v2/switch-back-button';
import {
  NavSignalMark,
  QUIET_NAV_SIGNAL,
  useCollabNavSignal,
} from '@/v2/features/channels/my-channels/nav-signal';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import type { SessionUser } from '@/v2/runtime/session';
import { LogoWordmark } from './Logo';
import { V2UserFooter } from './V2UserFooter';
import { v2NewChat, visibleNavItems, type V2NavItem } from './nav.config';

/**
 * V2Sidebar — the desktop navigation rail, built on the shadcn sidebar
 * primitives. Off-canvas collapsible: `SidebarTrigger` (in `V2Header`) slides the
 * whole rail away and `SidebarInset` reclaims the width.
 *
 * DESIGN PASS (owner #22): a deliberate spacing rhythm — a generous header with
 * the h-10 wordmark (#5), grouped nav with quiet uppercase section labels, calm
 * hover/active tints that fade rather than snap, and a footer set off from the
 * scroll region by a hairline. Every interactive state carries `transition-colors`
 * (owner rule #17 — no snap). The active tint is the brand gold at low opacity so
 * the current route reads without shouting.
 *
 * MOBILE: returns `null`. The shadcn `<Sidebar>` would otherwise render its own
 * mobile `<Sheet>` bound to `openMobile`; suppressing it leaves `openMobile` to
 * drive ONLY `V2Drawer`. `useIsMobile()` is `false` during SSR and first paint, so
 * the rail still ships in the server HTML (CSS `hidden md:block`), then unmounts
 * post-hydration on real mobile.
 *
 * SEAMLESS CHROME (owner #10): the rail's edge border is removed by overriding the
 * primitive's `group-data-[side=left]:border-r` from here — components/ui/sidebar
 * is v1-shared and must stay byte-identical.
 */

/** Shared active-row tint (brand gold, low opacity) — one definition for the top
 *  nav rows, Library children, and recents, so the active treatment never drifts. */
const ACTIVE_ROW =
  'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary';

/**
 * A top-level nav group with expandable children (Library). Extracted so it can
 * own the first-toggle flag that gates the collapse ANIMATION (owner #42): the
 * shared `Collapsible` primitive is bare Radix, so this attaches the `.v2-collapse`
 * height utility (shell.css) to the content — but only AFTER the first user toggle,
 * because a `defaultOpen` collapsible would otherwise PLAY the open animation on
 * first paint (the shell.css caveat). The flag is set in `onOpenChange` — an
 * event handler, never a setState-in-effect — so the initial render stays still
 * and every toggle thereafter animates BOTH directions.
 *
 * Open state is UNCONTROLLED (`defaultOpen`), deliberately: v1's Library was
 * permanently `open` (never collapsible — `nav-main.tsx` hardcodes `open={true}`
 * and never renders its chevron), so there is no remembered collapsed state to
 * honour. Starting open every mount matches that always-open feel while still
 * letting the row collapse (now animated). The persistent rail keeps the
 * uncontrolled state for the session; a full reload resets to open.
 */
function SidebarNavGroup({
  item,
  isActive,
}: {
  item: V2NavItem;
  isActive: (href: string) => boolean;
}) {
  const [hasToggled, setHasToggled] = useState(false);
  const Icon = item.icon;

  return (
    <Collapsible
      asChild
      defaultOpen
      onOpenChange={() => setHasToggled(true)}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.label} className="transition-colors">
            {Icon ? <Icon /> : null}
            <span>{item.label}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        {/* `.v2-collapse` animates the content height BOTH directions (shell.css),
            attached only post-first-toggle so first paint is still. */}
        <CollapsibleContent className={cn(hasToggled && 'v2-collapse')}>
          <SidebarMenuSub className="gap-0.5">
            {item.items?.map((sub) => {
              const active = isActive(sub.href);
              return (
                <SidebarMenuSubItem key={sub.label}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={active}
                    className={cn('transition-colors', active && ACTIVE_ROW)}
                  >
                    <Link href={sub.href}>
                      <span>{sub.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function V2Sidebar({ user }: { user: SessionUser | null }) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const signedIn = !!user;
  // The cache PARTITION for the recents key (see `ViewerScoped`). Taken from the
  // SERVER-verified user the layout already threads in here — no hook needed, and
  // it is the same id `V2SessionProvider` publishes.
  const viewerId = user?.id ?? null;

  // The SidebarContent element is the rail's scroll region — the infinite
  // sentinel measures its prefetch margin against THIS, not the viewport.
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
  // The Channels row's live unread signal — the same hook the drawer calls, so
  // the rail and the drawer can no more drift on what a row SAYS than on which
  // rows exist. Above the mobile early-return, because hooks are unconditional.
  const collabSignal = useCollabNavSignal();

  if (isMobile) return null;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const NewChatIcon = v2NewChat.icon;
  const recents = recentsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  // Role-gated rows (Quiz's research-account soft launch) are filtered from the
  // ONE config, with the SERVER-verified role the layout already threaded in —
  // so the rail and the drawer can never disagree about what exists.
  const navItems = visibleNavItems(user?.role ?? null);

  return (
    <Sidebar
      collapsible="offExamples"
      className="group-data-[side=left]:border-r-0"
    >
      <SidebarHeader className="px-3 pb-1 pt-3">
        <Link
          href={v2NewChat.href}
          aria-label="Lawexa home"
          className="inline-flex w-fit items-center rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <LogoWordmark className="h-10 w-auto" />
        </Link>
      </SidebarHeader>

      <SidebarContent ref={scrollRef} className="px-1">
        <SidebarGroup className="pb-1">
          <SidebarMenu className="gap-0.5">
            {/* New chat — a standard nav row (owner #9): identical shape/hover to
                every other row; only the label + icon carry the theme gold. */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={v2NewChat.label}
                className="font-medium text-primary transition-colors hover:text-primary [&_svg]:text-primary"
              >
                <Link href={v2NewChat.href}>
                  {NewChatIcon ? <NewChatIcon /> : null}
                  <span>{v2NewChat.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {navItems.map((item) => {
              const Icon = item.icon;

              // Expandable group (Library) — its own component so it can hold the
              // first-toggle flag that gates the collapse animation (owner #42).
              if (item.items && item.items.length > 0) {
                return (
                  <SidebarNavGroup
                    key={item.label}
                    item={item}
                    isActive={isActive}
                  />
                );
              }

              const active = isActive(item.href);
              // The unread grammar on the nav row: bold + gold dot = unread, a
              // number is ONLY ever mentions, no red. The label bolds here and
              // the mark renders in the trailing slot.
              const signal = item.signalId ? collabSignal : QUIET_NAV_SIGNAL;
              const alerting = signal.unread || signal.mentions > 0;
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    isActive={active}
                    className={cn(
                      'transition-colors',
                      active && ACTIVE_ROW,
                      !active && alerting && 'font-semibold',
                    )}
                  >
                    <Link href={item.href}>
                      {Icon ? <Icon /> : null}
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {/* The primitive's OWN badge slot, not a child of the button:
                      `SidebarMenuButton` is `overflow-hidden` and collapses to
                      `size-8 p-2` in the icon rail, so a mark inside it is
                      clipped there. `SidebarMenuBadge` is the sibling the
                      primitive positions for exactly this, and it hides itself
                      when the rail collapses — where the row is a bare icon
                      with a tooltip and has no room to say more. */}
                  {alerting ? (
                    <SidebarMenuBadge>
                      <NavSignalMark signal={signal} />
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Recent — real conversations (read-only). Hidden entirely for guests. */}
        {signedIn ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Recent
            </SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              {recentsQuery.isPending ? (
                [0.9, 0.7, 0.5, 0.35, 0.2].map((opacity, index) => (
                  <SidebarMenuItem key={index}>
                    <div
                      className="flex items-center gap-2 px-2 py-1.5"
                      style={{ opacity }}
                    >
                      <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
                      <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
                    </div>
                  </SidebarMenuItem>
                ))
              ) : recentsQuery.isError ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  Couldn&apos;t load conversations
                </div>
              ) : recents.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  No conversations yet
                </div>
              ) : (
                recents.map((conversation) => {
                  const title = stripPastedTags(conversation.title);
                  const active = isActive(`/c/${conversation.id}`);
                  return (
                    <SidebarMenuItem
                      key={conversation.id}
                      className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                    >
                      <SidebarMenuButton
                        asChild
                        tooltip={title}
                        isActive={active}
                        className={cn(
                          'text-muted-foreground transition-colors',
                          active && ACTIVE_ROW,
                        )}
                      >
                        <Link href={`/c/${conversation.id}`}>
                          <MessageSquare />
                          <span className="truncate">{title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}

              {/* Infinite sentinel (owner #26): while more pages exist this row
                  lives at the end of the scroll region; scrolling it into view
                  loads the next page, and a skeleton fills it while that page is
                  in flight (skeleton-first). It disappears once the list is fully
                  loaded, so there is no dangling spacer. */}
              {recentsQuery.hasNextPage ? (
                <SidebarMenuItem>
                  <div ref={sentinelRef} aria-hidden className="px-2 py-1.5">
                    {recentsQuery.isFetchingNextPage ? (
                      <div className="flex items-center gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                        <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
                        <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
                      </div>
                    ) : null}
                  </div>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-sidebar-border/60 p-2">
        <V2UserFooter user={user} />
        {/* Always-available exit from the preview. */}
        <SwitchBackButton />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
