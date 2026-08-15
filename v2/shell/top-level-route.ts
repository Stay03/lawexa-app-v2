/**
 * top-level-route — which screens you did NOT push into, decided by the address
 * and nothing else. The twin of `pushed-route.ts`, and the other half of the
 * same grammar.
 *
 * ── THE RULE THIS COMPLETES ────────────────────────────────────────────────
 * The owner studied the Claude and ChatGPT phone apps and settled it:
 *
 *   A TOP-LEVEL screen  the bar carries NO title and stops being a bar: no
 *                       background, no rule line, round solid buttons sitting
 *                       ON the page, and the content passing UNDER them as it
 *                       scrolls. The big title lives in the PAGE body.
 *   A PUSHED screen     a back arrow on the left, a small title in the BAR, no
 *                       hamburger, and never a second title.
 *
 * `pushed-route.ts` shipped the second clause. This is the first.
 *
 * ── WHY THE ADDRESS DECIDES ────────────────────────────────────────────────
 * Verbatim from `pushed-route.ts`, because the failure is the same one: a
 * screen that PUBLISHES "I am top-level" answers one paint too late, and the
 * reader watches the bar's background disappear and the content jump up under
 * it. Whether a screen is top-level is a FACT ABOUT THE ROUTE — `/cases`
 * always is, `/cases/{slug}` never is — so it is read off the pathname,
 * synchronously, and the answer is identical on the server render, the first
 * client paint and every paint after it.
 *
 * The two tables are DISJOINT by construction: every address this one answers
 * for, `pushedScreenFor` returns `null` for. `isTopLevelRoute` is asserted
 * against that in `V2Header`, where both are read.
 *
 * ── WHAT THE TABLE CARRIES ─────────────────────────────────────────────────
 * The screen's TITLE, and only that. Where it goes (the page body, at
 * `ScreenTitle`'s scale) and what else the screen shows (a search pill, a
 * floating action) are the screen's own business — a table that also owned
 * those would have to know each screen's query state and each screen's create
 * dialog, which is how a shell config turns into a second copy of the app.
 *
 * A `null` title means THE SCREEN ALREADY HAS ITS OWN HEADING and must not be
 * given a second one. Two screens are in that position and both are correct as
 * they stand: the home renders the greeting (`HomeGreeting`'s `h1`) and the
 * quiz hub renders its hero sentence. The one-`h1`-per-screen rule is kept by
 * the table refusing to add one, not by each screen remembering not to.
 *
 * No JSX and no hooks, so server and client trees both import it.
 */

export interface TopLevelScreen {
  /**
   * The big title the PAGE body prints, or `null` where the screen already
   * owns its one heading (see the docblock).
   */
  title: string | null;
}

/**
 * The internal tree's prefix. The proxy rewrites `/cases` to `/v2/cases`, so an
 * opted-in reader normally sees the clean path, but a direct `/v2/...` hit is
 * allowed through with the cookie and `usePathname()` then returns the prefixed
 * form. Both must resolve to the same screen or the whole treatment would
 * silently vanish on the internal address. Same guard as `pushedScreenFor`.
 */
const V2_PREFIX = '/v2';

function cleanPath(pathname: string): string {
  if (pathname === V2_PREFIX) return '/';
  return pathname.startsWith(`${V2_PREFIX}/`)
    ? pathname.slice(V2_PREFIX.length)
    : pathname;
}

/** Frozen singleton for the screens that already own their heading. */
const OWN_HEADING: TopLevelScreen = { title: null };

/**
 * The table. Keys are CLEAN paths with no query and no trailing slash — every
 * top-level screen in the v2 tree is a static segment, which is precisely what
 * makes it top-level, so no pattern matching is needed or wanted here.
 */
const TOP_LEVEL: ReadonlyMap<string, TopLevelScreen> = new Map([
  // The home, all three tabs. The greeting is the heading; the bar keeps the
  // Chat|Work|Study control (owner #34), which is a product control and not a
  // title, so it is the one thing that still rides a see-through bar.
  ['/', OWN_HEADING],
  ['/work', OWN_HEADING],
  ['/study', OWN_HEADING],

  // The library lists.
  ['/cases', { title: 'Cases' }],
  ['/statutes', { title: 'Statutes' }],
  ['/notes', { title: 'Notes' }],
  ['/folders', { title: 'Folders' }],
  ['/bookmarks', { title: 'Bookmarks' }],
  ['/radars', { title: 'Radar' }],
  ['/conversations', { title: 'Conversations' }],

  // Collab. `/spaces/{uuid}` and `/channels/{uuid}` are pushed screens with a
  // published context of their own; only the two indexes are here.
  ['/spaces', { title: 'Spaces' }],
  ['/channels', { title: 'My channels' }],

  // The quiz hub opens on its own hero sentence, which IS its heading.
  ['/quiz', OWN_HEADING],
]);

/**
 * The screen `pathname` names, or `null` when it is not a top-level screen.
 *
 * Pure, synchronous and total: an address this table does not recognise gets
 * `null` and keeps the ordinary opaque bar, which is the safe answer — an
 * unrecognised screen loses nothing, where a wrongly see-through one would put
 * its content under a bar it did not expect.
 */
export function topLevelScreenFor(pathname: string): TopLevelScreen | null {
  return TOP_LEVEL.get(cleanPath(pathname)) ?? null;
}

/** Is this address a top-level screen at all? The predicate the shell frame and
 *  the header both branch on. */
export function isTopLevelRoute(pathname: string): boolean {
  return TOP_LEVEL.has(cleanPath(pathname));
}
