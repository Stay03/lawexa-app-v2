'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { LogOut, Moon, MoreVertical, Settings, Sun, SunMoon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { switchBackToV1 } from '@/app/v2/switch-back-button';
import { useMounted } from './use-mounted';
import { useScreenActions } from './screen-context';

/**
 * V2HeaderMenu — the header's right-cluster overflow menu (owner #28). The theme
 * toggle used to sit bare on the bar; it now lives INSIDE this dropdown, leaving
 * the bar with just the bell + this single overflow button. The menu is built to
 * absorb future chrome items — today it carries the appearance toggle and a
 * "Switch to classic Lawexa" exit.
 *
 * THEME ROW behaviour (deliberate): clicking it toggles light/dark but KEEPS the
 * menu open (`onSelect` preventDefault), so the row's icon + "Dark/Light" state
 * flips in place and the user can see the change without the menu snapping shut.
 *
 * HYDRATION-SAFE without setState-in-effect: `next-themes` can't resolve the
 * theme on the server, so `useMounted` (the shared shell idiom) holds a neutral
 * glyph/label until the client mounts, then React re-renders with the real state
 * — no mismatch, no lint violation. The trigger glyph is theme-neutral, so the
 * bar itself never flashes.
 *
 * SETTINGS ROW. This menu is the ONE door to v2's settings home, which is why
 * `/settings` is a PUSHED screen and not a top-level one — see
 * `v2/shell/pushed-route.ts`.
 *
 * It replaces the role-gated DEVELOPER row that used to sit here. That row
 * existed for exactly one reason, stated in this docblock until 16 August 2026:
 * "v2 has no Settings surface of its own — `/settings` is not in
 * `routes.manifest.ts` and the nav config has no entry — so the developer flags
 * were unreachable from inside v2". v2 has one now, Developer is a row on it,
 * and a shortcut that duplicates a row one tap away is the crowding this bar is
 * kept clear of (owner #28). Nobody loses the way out of the preview either:
 * "Switch to classic Lawexa" is still one press, below.
 *
 * The row is NOT gated. A guest opening it meets a screen that offers them the
 * two doors into an account and the two device preferences that work without
 * one, which is a true answer; hiding settings from them would not be.
 *
 * ── THE SCREEN'S OWN ROWS COME FIRST (phase 7) ─────────────────────────────
 * A screen used to grow its own kebab in the page body under a bar that already
 * had one: `/folders/{uuid}` at y124, `/spaces/{uuid}` at y183. Two identical
 * glyphs, two different menus, and no way to tell from the outside which held
 * Delete. The screen now publishes its rows (`screen-context.ts`) and they open
 * at the HEAD of this menu, above a separator, so there is one overflow in the
 * bar and one place to look. It is the same fold `PlaceHeader` already does with
 * a channel's lenses on a phone.
 *
 * They lead rather than trail because they are what the reader came for; Theme
 * and "Switch to classic Lawexa" are app furniture and belong under the rule.
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
  const mounted = useMounted();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const screenActions = useScreenActions(usePathname() ?? '');

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

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
        {screenActions.length > 0 ? (
          // The separator rides the GROUP, not the last row, so a screen with
          // no actions never opens this menu on a rule with nothing above it.
          <DropdownMenuGroup>
            {screenActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                className="min-h-11 md:min-h-8"
                variant={action.destructive ? 'destructive' : 'default'}
                onSelect={action.onSelect}
              >
                <action.icon aria-hidden className="size-4" />
                <span>{action.label}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </DropdownMenuGroup>
        ) : null}

        <DropdownMenuItem asChild className="min-h-11 md:min-h-8">
          <Link href="/settings">
            <Settings className="text-muted-foreground" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          // 44px touch rows on mobile (a11y floor); default density on desktop.
          className="min-h-11 md:min-h-8"
          // Keep the menu open so the state flip is visible in place.
          onSelect={(event) => {
            event.preventDefault();
            toggleTheme();
          }}
        >
          {!mounted ? (
            <SunMoon className="text-muted-foreground" />
          ) : isDark ? (
            <Moon className="text-muted-foreground" />
          ) : (
            <Sun className="text-muted-foreground" />
          )}
          <span className="flex-1">Theme</span>
          {mounted ? (
            <span className="text-xs text-muted-foreground">
              {isDark ? 'Dark' : 'Light'}
            </span>
          ) : null}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="min-h-11 md:min-h-8"
          onSelect={switchBackToV1}
        >
          <LogOut className="text-muted-foreground" />
          <span>Switch to classic Lawexa</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
