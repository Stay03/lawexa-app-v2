'use client';

import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import type { SessionUser } from '@/v2/runtime/session';
import { LogoMark, LogoWordmark } from './Logo';
import { V2NotificationBell } from './V2NotificationBell';
import { V2ThemeToggle } from './V2ThemeToggle';
import { DesignSwitch } from './DesignSwitch';

/**
 * V2Header — the top bar, deliberately UNCROWDED (a binding owner decision):
 * a left nav/brand cluster, a breadcrumb slot, and a right cluster of exactly
 * three chrome controls — nothing else lands here.
 *
 *  - Mobile (`md:hidden`): the hamburger (keeps `id="v2-nav-trigger"`, the
 *    focus-restore target for V2Drawer's `onCloseAutoFocus` — DO NOT CHANGE) plus
 *    the compact square LogoMark (the wordmark would crowd a 360px bar next to
 *    the right cluster; the full wordmark still lives in the drawer + sidebar).
 *  - Desktop (`hidden md:*`): `SidebarTrigger` (slides the rail off-canvas), the
 *    wordmark ONLY while the rail is collapsed (the expanded rail already shows
 *    it — this keeps the brand visible in every chrome state without ever
 *    duplicating it), a separator, and the "Home" breadcrumb slot.
 *  - Right cluster (both): notification bell (hidden for guests) + theme toggle +
 *    the dev design switch. All shrink-0 so they never wrap; the breadcrumb
 *    spacer absorbs the slack, keeping the row clean down to 320px.
 *
 * Visibility is CSS-driven (`md:` variants), not `useIsMobile()`, so the correct
 * bar paints before hydration with no flash.
 */
export function V2Header({ user }: { user: SessionUser | null }) {
  const { setOpenMobile, state } = useSidebar();
  const signedIn = !!user;
  const railCollapsed = state === 'collapsed';

  return (
    <div className="flex h-14 items-center gap-2 px-3">
      {/* Mobile: hamburger opens the drawer. The id is the focus-restore target
          for V2Drawer's onCloseAutoFocus (no SheetTrigger exists). */}
      <Button
        id="v2-nav-trigger"
        variant="ghost"
        size="icon"
        className="size-11 rounded-full md:hidden"
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
      <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
      {railCollapsed ? (
        <span className="hidden shrink-0 items-center md:flex">
          <LogoWordmark className="h-9" />
        </span>
      ) : null}
      <Separator orientation="vertical" className="mr-1 hidden h-4 md:block" />
      <span className="hidden text-sm text-muted-foreground md:inline">Home</span>

      <span className="flex-1" />

      {/* Right cluster — bell + theme + design switch. Uncrowded by decree. */}
      <div className="flex shrink-0 items-center gap-1">
        <V2NotificationBell signedIn={signedIn} />
        <V2ThemeToggle />
        <DesignSwitch />
      </div>
    </div>
  );
}
