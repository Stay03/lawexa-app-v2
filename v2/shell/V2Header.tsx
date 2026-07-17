'use client';

import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

/**
 * V2Header — the top bar, deliberately minimal (the audit flagged v1's header as
 * overloaded, so this ships only what the shell needs and leaves a right-side
 * actions slot for later phases).
 *
 *  - Mobile (`md:hidden`): a hamburger that opens `V2Drawer`, plus the wordmark.
 *  - Desktop (`hidden md:*`): `SidebarTrigger` (slides the rail off-canvas) and a
 *    breadcrumb slot placeholder.
 *
 * Visibility is CSS-driven (Tailwind `md:` variants), not `useIsMobile()`, so the
 * correct bar paints before hydration with no flash. Lives inside the shell's
 * `<header>` (which already applies `v2-safe-top`), so it only draws the bar.
 */
export function V2Header() {
  const { setOpenMobile } = useSidebar();

  return (
    <div className="flex h-14 items-center gap-2 border-b border-border px-3">
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
      <span className="flex items-center gap-1.5 md:hidden">
        <span className="font-comfortaa text-base font-semibold tracking-tight text-foreground">
          Lawexa
        </span>
      </span>

      {/* Desktop: sidebar trigger + breadcrumb slot placeholder. */}
      <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
      <Separator
        orientation="vertical"
        className="mr-1 hidden h-4 md:block"
      />
      <span className="hidden text-sm text-muted-foreground md:inline">
        Home
      </span>

      <span className="flex-1" />

      {/* Right-side actions slot — intentionally empty this wave (kept
          uncrowded per the audit). Feature actions land in later phases. */}
    </div>
  );
}
