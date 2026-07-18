'use client';

import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import type { SessionUser } from '@/v2/runtime/session';
import { LogoMark, LogoWordmark } from './Logo';
import { V2NotificationBell } from './V2NotificationBell';
import { V2HeaderMenu } from './V2HeaderMenu';
import { DesignSwitch } from './DesignSwitch';

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
 *      it), a separator, and the "Home" breadcrumb slot.
 *  - CENTRE (grid col 2, auto): the dev A|B `DesignSwitch`, centred on mobile AND
 *    desktop. Equal `1fr` side columns keep it dead-centre; both clusters fit
 *    inside their track down to 320px, so it never collides.
 *  - RIGHT (grid col 3): exactly TWO controls (owner #28) — the notification bell
 *    (hidden for guests) and the overflow menu (`V2HeaderMenu`), which now owns
 *    the light/dark theme toggle. The bare theme button has left the bar.
 *
 * Visibility is CSS-driven (`md:` variants), not `useIsMobile()`, so the correct
 * bar paints before hydration with no flash.
 */
export function V2Header({ user }: { user: SessionUser | null }) {
  const { setOpenMobile, state } = useSidebar();
  const signedIn = !!user;
  const railCollapsed = state === 'collapsed';

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
        <Separator orientation="vertical" className="mr-1 hidden h-4 md:block" />
        <span className="hidden truncate text-sm text-muted-foreground md:inline">
          Home
        </span>
      </div>

      {/* CENTRE — the dev design switch, true centre of the bar (owner #29). */}
      <div className="flex justify-center">
        <DesignSwitch />
      </div>

      {/* RIGHT cluster — bell + overflow menu (owner #28). Uncrowded by decree. */}
      <div className="flex min-w-0 items-center justify-end gap-1">
        <V2NotificationBell signedIn={signedIn} />
        <V2HeaderMenu />
      </div>
    </div>
  );
}
