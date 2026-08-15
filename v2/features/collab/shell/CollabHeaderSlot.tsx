'use client';

import Link from 'next/link';
import { useBackTo } from '@/v2/runtime/back-to';
import { ChevronLeft, PanelLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CrestSkeleton, SpaceCrest } from '@/v2/features/collab/kit/Crest';
import {
  SPACE_DRAWER_TRIGGER_ID,
  type CollabHeaderContext,
} from './collab-header';

/**
 * CollabHeaderSlot — what the shell header carries while the reader is inside
 * a space. Three pieces, placed by `V2Header` into the clusters it already has.
 *
 * ── WHAT IT FIXES ──────────────────────────────────────────────────────────
 * On a phone, a channel screen said which space it was in through one 14px
 * muted text link buried as the third element of a middot line. There was no
 * "up", and the only persistent chrome — the global drawer — holds AI
 * conversations.
 *
 * ── THE THREE WIDTHS, AND WHY EACH CARRIES WHAT IT DOES ────────────────────
 * The rail docks at `lg:` (1024px). The channel screen's own `PlaceHeader`
 * gains its breadcrumb and section switch at `md:` (768px). Those two
 * breakpoints, not one, are what this slot has to answer:
 *
 *   < md    — no rail, no PlaceHeader extras. The header is the ONLY thing that
 *             can say where you are, so the centre carries the space crest and
 *             the space's name. It is a TITLE and not a control (phase 7 — see
 *             {@link CollabHeaderTitle}); the way into the channel list is the
 *             lobby's own labelled "All channels" button.
 *   md–lg   — no rail, but PlaceHeader now names the channel and its space
 *             directly under this bar. Repeating the name here would print it
 *             twice on one screen, so the centre goes EMPTY and the only thing
 *             this slot adds is a `PanelLeft` toggle in the left cluster,
 *             beside the sidebar trigger it mirrors. It is a control, not an
 *             identity, so it is a panel glyph and not a second crest.
 *   ≥ lg    — the rail is docked. Nothing here at all: the place is on screen,
 *             permanently, and there is no drawer left to open.
 *
 * The back chevron follows the RAIL's breakpoint rather than PlaceHeader's:
 * "up, out of this channel" is exactly what the rail provides once it is
 * docked, and what nothing else provides below it.
 *
 * Every switch is a CSS variant, never a hook, so the correct control paints
 * before hydration with no flash — and `hidden` is `display:none`, which
 * removes the inactive variant from the tab order and the accessibility tree,
 * so unlike the opacity cross-fade beside it, none of these needs `inert`.
 *
 * ── SKELETON-FIRST, NEVER A PLACEHOLDER STRING ─────────────────────────────
 * The crest reserves its box while the space is unknown (a hue derived from
 * anything but the uuid would visibly change once the real one arrived), and
 * the text lines hold their shape as bars. Nothing here ever renders the word
 * "Loading" — and nothing here renders AT ALL once the place has been refused,
 * because the frame stops publishing a context (see `CollabFrame`). That is
 * what keeps a shimmer from outliving a 403 forever.
 */

/** The mobile/tablet "up" control — present wherever the rail is not docked. */
export function CollabHeaderBack({ context }: { context: CollabHeaderContext }) {
  // Back when the space really is behind you, a link when it is not.
  const back = useBackTo(context.backHref);
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 rounded-full text-muted-foreground lg:hidden"
    >
      <Link {...back} aria-label={context.backLabel}>
        <ChevronLeft aria-hidden className="size-5" />
      </Link>
    </Button>
  );
}

/**
 * The `md:`–`lg:` drawer toggle: a panel glyph in the left cluster, beside the
 * sidebar trigger whose idiom it borrows, and now the ONLY opener in this bar.
 * Below `md:` the space lobby's own "All channels" button opens the drawer; at
 * `lg:` the rail is docked and nothing needs opening at all.
 */
export function CollabHeaderRailToggle({
  context,
}: {
  context: CollabHeaderContext;
}) {
  return (
    <Button
      id={SPACE_DRAWER_TRIGGER_ID}
      variant="ghost"
      size="icon"
      onClick={context.openRail}
      aria-label={
        context.spaceName
          ? `Channels in ${context.spaceName}`
          : 'Channels in this space'
      }
      className="hidden size-8 shrink-0 text-muted-foreground md:inline-flex lg:hidden"
    >
      <PanelLeft aria-hidden className="size-4" />
    </Button>
  );
}

const CLUSTER = 'flex w-full min-w-0 items-center gap-2 px-1.5 py-1';

/**
 * The header's centre payload, BELOW `md:` only — the crest, the channel name
 * and the space name under it. Fixed width per breakpoint, like the generic
 * route context it replaces, so a long name truncates instead of shoving the
 * bell and the menu off the bar.
 *
 * ── IT IS A TITLE, NOT A DOOR (phase 7) ────────────────────────────────────
 * The whole cluster used to be a BUTTON that opened the channel drawer. On
 * `/spaces/{uuid}` that made the bar's own title the third navigation control
 * in one row — hamburger at x12, back chevron at x64, and the title itself —
 * which is the screen the owner filmed and called the worst in the product. A
 * bar title says where you are; it does not take you somewhere.
 *
 * Nothing is lost by it, for two reasons. The space lobby's channel block
 * carries a LABELLED "All channels" button (`lg:hidden`, `SpaceLobbyBlocks`),
 * which is a better affordance than a crest that happens to be pressable
 * because it says what it opens. And this slot ONLY EVER PAINTS ON A SPACE
 * ADDRESS: it is `md:hidden`, and on `/channels/{uuid}` the whole shell bar is
 * `max-md:hidden` because the channel screen wears its own (`screenOwnsPhoneBar`
 * in `V2Header`) — so the two rules together left the button on no screen at
 * all. It went with the second trigger id, which had nothing left to sit on.
 */
export function CollabHeaderTitle({
  context,
}: {
  context: CollabHeaderContext;
}) {
  const { spaceUuid, spaceName, spaceType, channelName } = context;
  // On a space route the space name IS the title, so there is no kicker to
  // repeat it under.
  const title = channelName ?? spaceName;
  const kicker = channelName === null ? null : spaceName;

  return (
    <div className="flex w-36 min-w-0 items-center min-[400px]:w-52 sm:w-64 md:hidden">
      {/* No focus ring, no hover tint, no tab stop: it is not a control. */}
      <span className={CLUSTER}>
        {spaceUuid !== null && spaceType !== null && spaceName !== null ? (
          <SpaceCrest
            uuid={spaceUuid}
            name={spaceName}
            type={spaceType}
            size="sm"
          />
        ) : (
          <CrestSkeleton size="sm" />
        )}
        <span className="flex min-w-0 flex-1 flex-col items-start">
          {title === null ? (
            <Skeleton aria-hidden className="h-3.5 w-24 rounded" />
          ) : (
            <span className="min-w-0 max-w-full truncate text-sm font-medium text-foreground">
              {title}
            </span>
          )}
          {kicker !== null ? (
            <span className="min-w-0 max-w-full truncate text-[11px] leading-tight text-muted-foreground">
              {kicker}
            </span>
          ) : null}
        </span>
      </span>
    </div>
  );
}
