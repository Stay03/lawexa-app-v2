'use client';

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { useEffect } from 'react';

import { themeCookieSet } from '@/lib/theme-cookie';

/**
 * Mirrors the RESOLVED theme into `lawexa-theme` so the server can see it.
 * next-themes keeps the theme in localStorage, which no request carries; the
 * one server consumer today is `app/manifest.webmanifest/route.ts`, which
 * colours the installed Android app's status bar with whichever theme the
 * reader was in when they installed. Renders nothing.
 *
 * `resolvedTheme`, not `theme`: with `enableSystem` the stored value can be
 * `system`, and the manifest needs the colour actually on screen, which only
 * this client can resolve. Before hydration resolves it the value is
 * undefined and nothing is written — the previous visit's cookie (or the
 * manifest's no-cookie dark fallback) answers instead.
 */
function ThemeCookieMirror() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme === 'light' || resolvedTheme === 'dark') {
      document.cookie = themeCookieSet(resolvedTheme);
    }
  }, [resolvedTheme]);

  return null;
}

/**
 * A first visit follows the device's light or dark setting (Stay, 26 October
 * 2026, thread "Moving to v2 UI": "Device"). It was `"dark"` from the first
 * version of this file on 13 January 2026, so a phone set to light opened
 * dark. A reader who has picked a theme keeps it: next-themes stores the pick
 * and reads it before this default.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeCookieMirror />
      {children}
    </NextThemesProvider>
  );
}
