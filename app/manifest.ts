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
    theme_color: '#C9A227',
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
