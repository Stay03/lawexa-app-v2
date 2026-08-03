'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { FlaskConical, LogOut, Moon, MoreVertical, Sun, SunMoon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { canAccessV2Preview } from '@/lib/utils/v2-access';
import { switchBackToV1 } from '@/app/v2/switch-back-button';
import { useV2Session } from '@/v2/runtime/session-context';
import { useMounted } from './use-mounted';

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
 * DEVELOPER ROW (role-gated). v2 has no Settings surface of its own — `/settings`
 * is not in `routes.manifest.ts` and the nav config has no entry — so the
 * developer flags (the v2-preview cookie, the streaming style) were unreachable
 * from inside v2. This row is the one path to them. It is gated by
 * `canAccessV2Preview` on the SERVER-VERIFIED role from `useV2Session`, exactly
 * like the v1 nav link and the `/settings/developer` page's own fallback — since
 * Aug 3, 2026 that audience is every registered account, so only guests/bots
 * miss the row. `/settings/developer` still lives in v1, so this is a genuine
 * cross-experience link — a real `<Link>`/anchor, so it is middle-clickable and
 * copyable rather than a JS-only jump.
 */
export function V2HeaderMenu() {
  const mounted = useMounted();
  const { role } = useV2Session();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const showDeveloper = canAccessV2Preview(role);

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 rounded-full text-muted-foreground md:size-9"
          aria-label="More options"
        >
          <MoreVertical className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
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

        {showDeveloper ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="min-h-11 md:min-h-8">
              <Link href="/settings/developer">
                <FlaskConical className="text-muted-foreground" />
                <span>Developer</span>
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}

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
