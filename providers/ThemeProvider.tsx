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
 * no-cookie dark default, matching `defaultTheme` below) answers instead.
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeCookieMirror />
      {children}
    </NextThemesProvider>
  );
}
