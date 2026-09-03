import type { MetadataRoute } from 'next';
import { cookies } from 'next/headers';

import { THEME_COOKIE } from '@/lib/theme-cookie';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lawexa.com';

/**
 * The web app manifest, served at /manifest.webmanifest — a route handler
 * rather than the `app/manifest.ts` convention this replaced, because this
 * response now VARIES BY THEME and the convention compiles to one static
 * answer for everybody.
 *
 * ── WHY IT VARIES (the owner, 2 September 2026) ────────────────────────────
 * Install the app while in light mode, get a light status bar; install in
 * dark, get a dark bar. Android bakes `theme_color` into the installed app at
 * install time and paints the system bar with it on every screen, ignoring
 * the page underneath — proven by shipping `#00E5FF` cyan and photographing a
 * cyan bar over both themes. So the ONE colour this file serves has to be the
 * right one for the person fetching it, at the moment they fetch it.
 *
 * ── HOW THE REQUEST CARRIES THE THEME ──────────────────────────────────────
 * A manifest is fetched with credentials mode `omit` BY DEFAULT, even
 * same-origin — measured against production on 2 September 2026: no Cookie
 * header. That default is overridden per spec by
 * `crossorigin="use-credentials"` on the <link>, which the root layout now
 * sets — and this was measured too, through Chrome's own manifest fetcher
 * (CDP `Page.getAppManifest`, the same path the install pipeline uses): the
 * bare link sent no cookies, the credentialed link sent them. So this handler
 * reads the resolved theme from the cookie `providers/ThemeProvider.tsx`
 * mirrors out of next-themes, and the address never changes — every page
 * keeps one constant, statically-renderable <link>.
 *
 * No cookie, or an unrecognised value, falls back to DARK — the same default
 * as `ThemeProvider defaultTheme="dark"`, so a first-ever visit gets the bar
 * that matches the page it is about to see.
 *
 * `Cache-Control: private, no-store` because the body is per-reader: a shared
 * cache serving one person's light manifest to everyone would put this bug
 * back in a harder-to-see form.
 */
export async function GET(): Promise<Response> {
  const store = await cookies();
  const light = store.get(THEME_COOKIE)?.value === 'light';

  /**
   * DARK GETS THE PAGE'S OWN SURFACE. LIGHT CANNOT, AND HERE IS WHY.
   *
   * This served `#ffffff` for light at first, matching the page exactly. The
   * owner reinstalled and lost his clock, his wifi and his signal. Four
   * screenshots settled it, two bars in both app themes, measured:
   *
   *   dark bar   → icons drawn WHITE, visible, in BOTH app themes
   *   white bar  → icons drawn WHITE, invisible, in BOTH app themes
   *   status bar pixel-identical between light and dark mode on each bar
   *
   * HIS PHONE ALWAYS PAINTS THE STATUS ICONS WHITE and ignores both this
   * colour and the page's. There is no web API to ask Android for dark icons —
   * iOS has one, Android does not — so the icons are not ours to fix. The one
   * lever we hold is this colour, which means IT MUST BE DARK ENOUGH TO CARRY
   * WHITE ICONS or the reader loses their clock.
   *
   * So light mode gets a grey rather than the page's white. `#52525b` puts
   * white icons at 7.7:1, comfortably readable, while being visibly grey rather
   * than the near-black slab over a white page that started all of this. It is
   * a compromise on purpose: an exact match to the page is not available while
   * the phone insists on white icons.
   *
   * Dark keeps `#0a0a0a`, the page's real surface, because white icons already
   * read on it.
   */
  const surface = light ? '#52525b' : '#0a0a0a';

  const manifest: MetadataRoute.Manifest = {
    id: '/',
    name: 'Lawexa - Where Modern Legal Work Happens',
    short_name: 'Lawexa',
    description:
      'Lawexa powers lawyers, students, and teams to research cases and laws across jurisdictions, draft, study, and collaborate with AI to get legal work done faster and reliably',
    start_url: '/',
    display: 'standalone',
    // With an origin-wide scope, Android's installed app (WebAPK) captures every
    // in-scope link — a shared case/note/radar/conversation/ambassador URL tapped
    // on a device that has Lawexa installed opens here instead of the browser.
    // `navigate-existing` makes that deterministic: an already-running app window
    // is focused AND navigated to the launched URL, so deep links always land on
    // the shared page rather than whatever screen the app was last showing.
    // (Chromium 110+; ignored by browsers that don't support it.)
    launch_handler: { client_mode: 'navigate-existing' },
    background_color: surface,
    theme_color: surface,
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // A 512x512 `purpose: 'maskable'` icon (opaque background, logo within the inner
      // 80% safe zone) should be added for edge-to-edge Android adaptive icons.
    ],
    // Self-reference lets getInstalledRelatedApps() confirm install from a tab on
    // Chromium desktop, so we don't show the install prompt to users who already have it.
    related_applications: [{ platform: 'webapp', url: `${APP_URL}/manifest.webmanifest`, id: '/' }],
    prefer_related_applications: false,
  };

  return Response.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'private, no-store',
    },
  });
}
