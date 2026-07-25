import { Briefcase, GraduationCap, MessageSquare, type LucideIcon } from 'lucide-react';

/**
 * The three home surfaces — Chat | Work | Study (owner #34) — and their ROUTES.
 *
 * ── WHY THIS REPLACED A STORE ───────────────────────────────────────────────
 * The active tab used to live in `localStorage`, read through `useSyncExternalStore`.
 * That made the tab a piece of client state the server could not know, and the cost
 * showed on every hard load: `getServerSnapshot()` had to return `'chat'`, so a user
 * whose last tab was Study got the CHAT surface server-rendered, the chat skeleton
 * while it loaded, and then a jolt to Study after hydration. The owner reported
 * exactly that — "if i'm in study and i refresh i first see the chat screen load for
 * a quick second then i see the study screen jumpy loads".
 *
 * No amount of tuning fixes it, because the server genuinely cannot know a value
 * that only exists in the browser. A URL can carry it. So each tab is now a real
 * route, which buys four things at once:
 *  1. The server renders the RIGHT surface first — no reconcile, no jolt.
 *  2. Each tab gets its OWN `loading.tsx`, so the skeleton matches the tab you are
 *     going to instead of the tab you last visited.
 *  3. Back/forward, bookmarks and shared links work on tabs.
 *  4. The tab control becomes plain links — prefetchable, middle-clickable,
 *     keyboard-navigable for free.
 *
 * Persistence is not lost, it is relocated: the browser's own history and the
 * address bar remember where you were, which is what a user expects of a page.
 *
 * ── THE v1 EDGE, STATED ─────────────────────────────────────────────────────
 * `/work` and `/study` exist only in v2. They are added to `routes.manifest.ts`, so
 * an opted-in user's request is rewritten into the v2 tree; a user WITHOUT the v2
 * cookie who follows such a link falls through to v1, which has no such page, and
 * gets v1's 404. That is acceptable while v2 is a preview — the links only exist
 * because a v2 user made them — and it disappears at cutover.
 *
 * No JSX and no hooks, so both server and client trees can import it.
 */

export type HomeTab = 'chat' | 'work' | 'study';

export interface HomeTabDef {
  value: HomeTab;
  label: string;
  /** The CLEAN path (what the address bar shows); the proxy rewrites it into /v2. */
  href: string;
  icon: LucideIcon;
}

export const HOME_TABS: readonly HomeTabDef[] = [
  { value: 'chat', label: 'Chat', href: '/', icon: MessageSquare },
  { value: 'work', label: 'Work', href: '/work', icon: Briefcase },
  { value: 'study', label: 'Study', href: '/study', icon: GraduationCap },
];

/** The clean paths the home tabs occupy — the set `V2Header` shows the control on. */
export const HOME_TAB_PATHS: readonly string[] = HOME_TABS.map((t) => t.href);

/**
 * Which tab a pathname is. Accepts BOTH the clean path the user sees (`/work`) and
 * the internal rewritten one (`/v2/work`), because `usePathname()` reports the clean
 * path under the proxy rewrite while a direct `/v2/*` hit reports the prefixed one.
 * Anything else is not a home route at all.
 */
export function homeTabForPath(pathname: string): HomeTab | null {
  const path = pathname === '/v2' ? '/' : pathname.replace(/^\/v2(?=\/)/, '');
  const match = HOME_TABS.find((tab) => tab.href === path);
  return match?.value ?? null;
}
