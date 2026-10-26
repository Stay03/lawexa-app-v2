'use client';

import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { MoreVertical } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ruledAbove, useScreenActions } from './screen-context';

/**
 * V2HeaderMenu — the bar's ⋮, holding the open screen's own actions and
 * nothing else.
 *
 * ── ONLY THE SCREEN'S ROWS (Stay, 26 October 2026) ─────────────────────────
 * "remove … the drop down menu at the top". It used to carry app furniture
 * too: Settings, Theme and "Switch to classic Lawexa". Settings and Theme moved
 * to the account menu at the foot of the sidebar (V2UserFooter), and the
 * classic switch went with the new design becoming everyone's default. What
 * stayed is what no other place holds: a chat's, folder's, note's, Space's,
 * statute's or quiz's own rows (Rename, Delete, Leave…), so the ⋮ draws only
 * on a screen that published some and is gone everywhere else.
 *
 * ── THE SCREEN'S OWN ROWS (phase 7) ────────────────────────────────────────
 * A screen used to grow its own kebab in the page body under a bar that already
 * had one: `/folders/{uuid}` at y124, `/spaces/{uuid}` at y183. Two identical
 * glyphs, two different menus, and no way to tell from the outside which held
 * Delete. The screen now publishes its rows (`screen-context.ts`) and they open
 * here, so there is one overflow in the bar and one place to look. It is the
 * same fold `PlaceHeader` already does with a channel's lenses on a phone.
 *
 * Inside the screen's rows, a rule goes before the first destructive verb and
 * wherever a row asks for one (`ruledAbove`), so a space's Leave and Delete
 * never run on from Rename (design round 2, 12 October 2026).
 * The rows are guarded by the pathname they were published for, so a menu
 * opened a frame into a new screen can never run the last screen's Delete.
 */
export function V2HeaderMenu({
  className,
}: {
  /** Extra classes for the TRIGGER. The bar passes the solid-circle treatment
   *  here on a see-through top-level screen (`V2Header#OPEN_BAR_CONTROL`); the
   *  dropdown this opens is untouched by it. */
  className?: string;
} = {}) {
  const screenActions = useScreenActions(usePathname() ?? '');

  // Nothing of the screen's own to offer: no ⋮ at all.
  if (screenActions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-11 rounded-full text-muted-foreground md:size-9',
            className,
          )}
          aria-label="More options"
        >
          <MoreVertical className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        {screenActions.map((action, index) => (
          <Fragment key={action.id}>
            {ruledAbove(screenActions, index) ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              // 44px touch rows on mobile (a11y floor); default density on desktop.
              className="min-h-11 md:min-h-8"
              variant={action.destructive ? 'destructive' : 'default'}
              onSelect={action.onSelect}
            >
              <action.icon aria-hidden className="size-4" />
              <span>{action.label}</span>
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
