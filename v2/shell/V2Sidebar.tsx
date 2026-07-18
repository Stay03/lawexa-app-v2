'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, MessageSquare } from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { SwitchBackButton } from '@/app/v2/switch-back-button';
import { conversationsQueries } from '@/v2/features/conversations/queries';
import type { SessionUser } from '@/v2/runtime/session';
import { LogoWordmark } from './Logo';
import { V2UserFooter } from './V2UserFooter';
import { v2NavItems, v2NewChat } from './nav.config';

/**
 * V2Sidebar — the desktop navigation rail, built on the shadcn sidebar
 * primitives (the v2 primitive layer). Off-canvas collapsible: `SidebarTrigger`
 * (in `V2Header`) slides the whole rail away and `SidebarInset` reclaims the
 * width — clean, with no half-styled icon-rail state to maintain this wave.
 *
 * MOBILE: returns `null`. The shadcn `<Sidebar>` would otherwise render its own
 * mobile `<Sheet>` bound to `openMobile`; suppressing it here leaves `openMobile`
 * to drive ONLY `V2Drawer` (the locked ChatGPT-style drawer), so the two never
 * double up. `useIsMobile()` is `false` during SSR and first paint, so the rail
 * still ships in the server HTML (CSS `hidden md:block` keeps it off small
 * screens with no flash), then unmounts post-hydration on real mobile.
 *
 * SEAMLESS CHROME (owner): the rail's edge border is removed by overriding the
 * primitive's `group-data-[side=left]:border-r` from here (the variant prefix is
 * required to beat the primitive's specificity) — components/ui/sidebar.tsx is
 * v1-shared and must stay byte-identical.
 */
export function V2Sidebar({ user }: { user: SessionUser | null }) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const signedIn = !!user;

  const recentsQuery = useQuery({
    ...conversationsQueries.recents(),
    enabled: signedIn,
  });

  if (isMobile) return null;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const NewChatIcon = v2NewChat.icon;
  const recents = recentsQuery.data?.data ?? [];

  return (
    <Sidebar
      collapsible="offExamples"
      className="group-data-[side=left]:border-r-0"
    >
      <SidebarHeader className="gap-3">
        <div className="flex items-center px-1 pt-1">
          <LogoWordmark className="h-8 w-auto" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {/* New chat — a standard nav row (owner): identical shape/hover to
                every other row; only the label + icon carry the theme gold. */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={v2NewChat.label}
                className="text-primary hover:text-primary [&_svg]:text-primary"
              >
                <Link href={v2NewChat.href}>
                  {NewChatIcon ? <NewChatIcon /> : null}
                  <span className="font-medium">{v2NewChat.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {v2NavItems.map((item) => {
              const Icon = item.icon;

              // Expandable group (Library) — always-available children.
              if (item.items && item.items.length > 0) {
                return (
                  <Collapsible
                    key={item.label}
                    asChild
                    defaultOpen
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.label}>
                          {Icon ? <Icon /> : null}
                          <span>{item.label}</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((sub) => {
                            const active = isActive(sub.href);
                            return (
                              <SidebarMenuSubItem key={sub.label}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={active}
                                  className={cn(
                                    active &&
                                      'bg-primary/10 text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary',
                                  )}
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

              const active = isActive(item.href);
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    isActive={active}
                    className={cn(
                      active &&
                        'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary',
                    )}
                  >
                    <Link href={item.href}>
                      {Icon ? <Icon /> : null}
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Recent — real conversations (read-only). Hidden entirely for guests. */}
        {signedIn ? (
          <SidebarGroup>
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
            <SidebarMenu>
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
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Couldn&apos;t load conversations
                </div>
              ) : recents.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No conversations yet
                </div>
              ) : (
                recents.map((conversation) => {
                  const title = stripPastedTags(conversation.title);
                  const active = isActive(`/c/${conversation.id}`);
                  return (
                    <SidebarMenuItem key={conversation.id}>
                      <SidebarMenuButton
                        asChild
                        tooltip={title}
                        isActive={active}
                        className={cn(
                          'text-muted-foreground',
                          active &&
                            'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary',
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
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="gap-2">
        <V2UserFooter user={user} />
        {/* Always-available exit from the preview. */}
        <SwitchBackButton />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
