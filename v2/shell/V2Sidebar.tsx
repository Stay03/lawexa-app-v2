'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
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
import { v2NavItems, v2NewChat, v2Recents } from './nav.config';

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
 */
export function V2Sidebar() {
  const isMobile = useIsMobile();
  const pathname = usePathname();

  if (isMobile) return null;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const NewChatIcon = v2NewChat.icon;

  return (
    <Sidebar collapsible="offExamples">
      <SidebarHeader className="gap-3">
        <div className="flex items-center gap-1.5 px-1 pt-1">
          <span className="font-comfortaa text-lg font-semibold tracking-tight text-foreground">
            Lawexa
          </span>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-primary">
            v2
          </span>
        </div>
        <Button
          asChild
          className="h-10 w-full justify-start gap-2 rounded-full"
        >
          <Link href={v2NewChat.href}>
            {NewChatIcon ? <NewChatIcon className="size-4" /> : null}
            <span>{v2NewChat.label}</span>
          </Link>
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
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

        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarMenu>
            {v2Recents.map((recent) => (
              <SidebarMenuItem key={recent.id}>
                {/* Sample data this wave — non-navigating until phase-3 wiring. */}
                <SidebarMenuButton
                  type="button"
                  className="text-muted-foreground"
                >
                  <span className="truncate">{recent.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2">
        <div className="flex items-center gap-2 rounded-lg px-1 py-1">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary"
            aria-hidden="true"
          >
            AO
          </span>
          <div className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate text-sm font-medium">Adaeze Okafor</span>
            <span className="truncate text-xs text-muted-foreground">
              Premium
            </span>
          </div>
        </div>
        {/* Always-available exit from the preview (deliverable #7). */}
        <SwitchBackButton />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
