'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useMinuteNow } from '@/v2/features/channels/use-minute-now';
import { focusSpaceDrawerTrigger } from './collab-header';
import { SpaceRail } from './SpaceRail';
import type { CollabSpaceScope } from './space-scope';

/**
 * SpaceDrawer — the space rail as a left sheet, for phones.
 *
 * ── IT HAS ITS OWN STATE, AND THAT IS THE POINT ────────────────────────────
 * It is NOT bound to `openMobile` in `components/ui/sidebar`. That state
 * belongs to the app navigation drawer — the one holding AI conversations and
 * the library — which has nothing to do with the space the reader is standing
 * in. Sharing it would mean one hamburger with two meanings and two panels
 * fighting over one flag. The two drawers coexist: the hamburger still opens
 * the app nav, and the space crest in the header opens this.
 *
 * ── BACK CLOSES IT ─────────────────────────────────────────────────────────
 * Its open state is a `useUrlOverlay('rail')` param owned by `CollabFrame`, so
 * on a phone — where Back is the universal dismiss — Back closes the drawer
 * instead of leaving the channel. The writes are QUIET: `/spaces/[spaceId]` and
 * `/channels/[channelId]` are dynamic routes, and a loud history write on one
 * restarts the `/undefined` refetch loop documented in `url-params.ts`.
 *
 * ── TAPPING A CHANNEL CLOSES IT AND SWAPS THE PANE ─────────────────────────
 * Every row is handed `onNavigate`, which the frame wires to `closeInPlace` —
 * the entry is REWRITTEN rather than popped, because the navigation that
 * follows in the same gesture would otherwise land on an entry a queued
 * `history.back()` is about to discard, and the reader would be bounced back to
 * the channel they just left.
 *
 * It is mounted at every width and only reachable below `lg:`, where the
 * docked rail is hidden — one component, one behaviour, no `useIsMobile()` and
 * therefore no pre-hydration flash.
 *
 * ── THE MINUTE CLOCK LIVES HERE, NOT IN THE FRAME ──────────────────────────
 * Only these rows show a relative age (the docked rail's rows are single-line
 * and show none), so this is the one component that needs a ticking clock.
 * Subscribing from the frame instead would re-render the frame — and with it
 * the rail, the scope object and the whole lobby — once a minute for a value
 * none of them read.
 */
export function SpaceDrawer({
  scope,
  open,
  onOpenChange,
  onNavigate,
  activeChannelUuid,
  atLobby,
}: {
  scope: CollabSpaceScope;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
  activeChannelUuid: string | null;
  atLobby: boolean;
}) {
  const now = useMinuteNow();
  const spaceName = scope.space?.name ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        // Variant-matched overrides: the primitive sets its width through
        // `data-[side=left]:*`, which beats unprefixed utilities on
        // specificity, so the overrides must carry the same prefix or they are
        // dead classes.
        className="gap-0 p-0 data-[side=left]:w-[min(88%,320px)] data-[side=left]:max-w-none data-[side=left]:sm:max-w-none"
        // Opened from the header, which is not a `SheetTrigger`, so Radix has
        // no trigger to restore focus to — without this, focus lands on <body>
        // and keyboard/AT readers lose their place. The header has two openers
        // at two widths, so the helper picks whichever one is on screen.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          focusSpaceDrawerTrigger();
        }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{spaceName ? `${spaceName} channels` : 'Channels'}</SheetTitle>
          <SheetDescription>
            The channels in this space, and the way to make another.
          </SheetDescription>
        </SheetHeader>

        <div className="v2-safe-top v2-safe-bottom flex min-h-0 flex-1 flex-col">
          <SpaceRail
            scope={scope}
            activeChannelUuid={activeChannelUuid}
            atLobby={atLobby}
            now={now}
            variant="drawer"
            onNavigate={onNavigate}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
