import type { Metadata } from 'next';
import { V2Home } from '../home';

/**
 * v2 `/work` — the Work home tab as a REAL ROUTE.
 *
 * The three home surfaces used to be one route switching on a `localStorage` value,
 * which meant the server always rendered Chat and the browser corrected it after
 * hydration: a hard load on Work showed the Chat surface and the Chat skeleton
 * first, then jolted. A route carries the tab in the URL, so the server renders this
 * surface directly and `loading.tsx` beside this file draws THIS tab's shape. See
 * `v2/shell/home-tabs.ts` for the full reasoning and the v1 edge it accepts.
 *
 * Awaits nothing: identity comes from `<V2SessionProvider>` in the v2 layout.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Work',
    description: 'Your spaces, channels and active matters in one place.',
    robots: { index: false, follow: false },
  };
}

/**
 * Keep this page in the client router cache for 5 minutes. Same lever and same
 * safety argument as `app/v2/conversations/page.tsx`, which carries the full note.
 * Moving between home tabs is now real navigation, so without it every tab switch
 * would pay a server round trip and show `loading.tsx`.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2WorkPage() {
  return <V2Home tab="work" />;
}
