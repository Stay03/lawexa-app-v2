import type { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lawexa.com';

// Served by Next.js at /manifest.webmanifest and auto-linked from <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
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
    background_color: '#ffffff',
    /**
     * THE STATUS BAR OF THE INSTALLED APP, NOT A BRAND SWATCH.
     *
     * The owner photographed a gold band across the top of a dark Chat screen on
     * 1 September 2026 and asked why it was still there, having been told the bar
     * was fixed on 22 August. Both were true. That fix corrected the page's
     * `theme-color` metas and works in a browser tab. An INSTALLED app does not
     * read them: Android bakes this value into the installed app and paints the
     * system bar with it, so the brand gold sat above every screen whatever the
     * page underneath was doing.
     *
     * Measured rather than reasoned: production serves the v2 pages `#ffffff`
     * and `#0a0a0a` and no gold at all, so the gold in the photograph could only
     * have come from here.
     *
     * WHY THIS VALUE. A manifest holds ONE colour and cannot follow the theme the
     * way the in-page correction does, so it is a choice about which half to fit.
     * The app's default theme is dark (`ThemeProvider defaultTheme="dark"`) and
     * this is the same `#0a0a0a` the dark pages already declare, so the common
     * case matches exactly. A reader in light mode gets a dark bar over a white
     * page, which is a smaller mismatch than gold over either.
     *
     * It does not repaint an already-installed app straight away. Android
     * refreshes the installed copy on its own schedule, days rather than minutes,
     * and only a reinstall is immediate.
     */
    /* ── TEMPORARY. A TEST COLOUR, AND IT MUST NOT STAY ────────────────────
     * 2 September 2026. The owner's installed app shows a black top bar that
     * ignores the app's own light/dark switch. Our explanation is that Android
     * paints that bar from THIS value, copied when the app is installed, and
     * that nothing the page does can reach it. Everything else we have is
     * inference; this is the one test that settles it outright.
     *
     * So this is a colour we have never used anywhere — not the brand gold, not
     * the near-black, and none of the three in the developer control — because
     * a colour we HAVE used could be a leftover from something else. He
     * reinstalls, and if his bar comes back cyan the source is proven. If it
     * stays black our whole explanation is wrong and we start again.
     *
     * REVERT TO `#0a0a0a` THE MOMENT HE HAS LOOKED. Anyone who installs the app
     * while this is live keeps cyan as their bar until they reinstall, so the
     * window is measured in minutes, deliberately. */
    theme_color: '#00E5FF',
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
}
