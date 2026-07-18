'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, SunMoon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * V2ThemeToggle — light/dark switch reading the root `next-themes` provider
 * (attribute="class", defaultTheme="dark") straight from the package hook.
 *
 * HYDRATION-SAFE without setState-in-effect: `next-themes` returns `undefined`
 * for the resolved theme on the server (it can't read `localStorage`/`class`
 * there), so rendering a theme-specific icon on the first paint would mismatch.
 * Instead of the classic `useState`+`useEffect` mounted flag (which the React
 * Compiler lint rejects), we derive `mounted` from `useSyncExternalStore`: its
 * server snapshot is `false` and its client snapshot is `true`, so the server
 * and first hydration render agree (neutral icon), then React re-renders with
 * the real icon — no flash of the wrong glyph, no lint violation.
 */

const subscribeNoop = () => () => {};

/** `false` on the server + first hydration render, `true` once on the client. */
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export function V2ThemeToggle() {
  const mounted = useMounted();
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  // Pre-mount: a theme-neutral glyph and a generic label, sized identically to
  // the resolved states so there is no layout shift when the real icon lands.
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-11 rounded-full text-muted-foreground md:size-9"
        aria-label="Toggle theme"
      >
        <SunMoon className="size-5" />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 rounded-full text-muted-foreground md:size-9"
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isDark ? 'Light mode' : 'Dark mode'}</TooltipContent>
    </Tooltip>
  );
}
