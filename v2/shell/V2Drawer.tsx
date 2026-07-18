'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useSidebar } from '@/components/ui/sidebar';
import { SwitchBackButton } from '@/app/v2/switch-back-button';
import type { SessionUser } from '@/v2/runtime/session';
import { LogoV2Badge, LogoWordmark } from './Logo';
import { V2UserFooter } from './V2UserFooter';
import { v2NavItems, v2NewChat, v2Recents } from './nav.config';

/**
 * V2Drawer — the mobile navigation drawer (Nav D, locked). ChatGPT-style
 * slide-in left panel: a fixed header, ONE scroll region holding the nav rows
 * then the Recents list (they scroll away together), and a pinned footer with
 * the gold "New chat" pill + avatar.
 *
 * Reuses `components/ui/sheet` (a Radix Dialog): it gives the scrim, Esc / scrim
 * close, focus trap, and the 200ms `side="left"` slide for free. The pinned
 * footer is achieved by making `SheetContent` a flex column and letting the
 * scroll region take `flex-1` — Sheet did not fight this layout. Bound to the
 * sidebar context's `openMobile`; on mobile `V2Sidebar` renders `null`, so this
 * is the sole consumer of that state (no competing sheet).
 */
export function V2Drawer({ user }: { user: SessionUser | null }) {
  const { openMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();

  const close = () => setOpenMobile(false);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const NewChatIcon = v2NewChat.icon;

  // Flatten the config into drawer rows: top-level items, with Library's
  // children promoted to indented sub-rows beneath it.
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
        // focus lands on <body> and keyboard/AT users lose their place
        // (reviewer finding).
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

        {/* Fixed header: wordmark + search + close. */}
        <div className="v2-safe-top flex h-14 shrink-0 items-center gap-1.5 border-b border-border px-3">
          <LogoWordmark className="h-7 w-auto" />
          <LogoV2Badge />
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

        {/* ONE scroll region: nav rows then Recents. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
          <nav aria-label="Primary" className="flex flex-col gap-0.5">
            {v2NavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <div key={item.label}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className={cn(
                      'flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    {Icon ? <Icon className="size-5 shrink-0" /> : null}
                    <span className="truncate">{item.label}</span>
                  </Link>
                  {item.items && item.items.length > 0 ? (
                    <div className="mb-1 ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
                      {item.items.map((sub) => {
                        const subActive = isActive(sub.href);
                        return (
                          <Link
                            key={sub.label}
                            href={sub.href}
                            onClick={close}
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
                  ) : null}
                </div>
              );
            })}
          </nav>

          <p className="px-3 pb-1 pt-4 text-xs font-medium text-muted-foreground">
            Recents
          </p>
          <div className="flex flex-col gap-0.5">
            {v2Recents.map((recent) => (
              <button
                key={recent.id}
                type="button"
                className="flex h-11 items-center rounded-lg px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="truncate">{recent.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pinned footer: gold New chat pill + real account row + preview exit. */}
        <div className="v2-safe-bottom flex shrink-0 flex-col gap-2 border-t border-border p-3">
          <Button asChild className="h-11 w-full justify-start gap-2 rounded-full">
            <Link href={v2NewChat.href} onClick={close}>
              {NewChatIcon ? <NewChatIcon className="size-4" /> : null}
              <span>{v2NewChat.label}</span>
            </Link>
          </Button>
          <V2UserFooter user={user} />
          <SwitchBackButton />
        </div>
      </SheetContent>
    </Sheet>
  );
}
