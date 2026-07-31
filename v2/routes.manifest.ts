/**
 * URL patterns that have been migrated to the v2 experience.
 *
 * The proxy consults this list: when the `lawexa-ui=v2` cookie is present and
 * the request path matches an entry here, the request is rewritten into the
 * hidden `app/v2/` tree. Anything not listed falls through to v1 untouched, so
 * the app grows page by page.
 *
 * Two pattern forms are supported:
 *  - an exact path, e.g. `'/cases'` — matches only `/cases`.
 *  - a `'/prefix/*'` wildcard, e.g. `'/cases/*'` — matches `/cases` and any
 *    path beneath it (`/cases`, `/cases/foo`, `/cases/foo/bar`).
 *
 * `'/'` is treated as an exact path and therefore matches ONLY the root — it is
 * never allowed to behave as a catch-all prefix.
 */
/**
 * `/work` and `/study` are v2-ONLY paths — the home's Work and Study tabs, which
 * became real routes so the server can render the right surface and the right
 * skeleton on a hard load (see `v2/shell/home-tabs.ts`). A user without the v2
 * cookie who follows one falls through to v1, which has no such page, and gets
 * v1's 404. Accepted while v2 is a preview: the links only exist because a v2 user
 * made them, and the edge closes at cutover.
 */
/**
 * `/cases/*` covers the library, every case page, and every full judgment. It is
 * the first PUBLIC surface v2 claims — a signed-out reader and a search-engine
 * crawler both land on the v2 tree only if they carry the opt-in cookie, so in
 * practice crawlers still see v1 until cutover. That is the correct order: the
 * v2 pages ship their metadata and OG cards now, and flipping the audience is a
 * separate, reversible decision.
 */
/**
 * `/statutes/*` is the second public library surface (list + AKN reader), on the
 * same audience argument as `/cases/*`. `/radars/*` is private (list, create,
 * detail, scan reports); the scan-report leaf can be opened by a share link, and
 * v1's separate `/settings` and `/scan-log` sub-routes intentionally do NOT come
 * along — v2 folds both into the detail screen, and an old link falls through
 * this same wildcard to the v2 detail's not-found handling rather than to v1.
 */
export const V2_ROUTES = [
  '/',
  '/work',
  '/study',
  '/c/*',
  '/conversations',
  '/cases/*',
  '/statutes/*',
  '/radars/*',
] as const;

export type V2Route = (typeof V2_ROUTES)[number];

/**
 * Whether `pathname` has been migrated to v2. Exact entries match the path
 * verbatim; `'/prefix/*'` entries match the prefix and everything below it.
 */
export function isMigratedToV2(pathname: string): boolean {
  return V2_ROUTES.some((pattern) => matchesRoute(pattern, pathname));
}

/**
 * Match a single manifest pattern against a pathname. A trailing `/*` turns the
 * entry into a prefix match (covering the prefix itself and any descendant);
 * every other entry — including `'/'` — is an exact match.
 */
function matchesRoute(pattern: string, pathname: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2); // drop the trailing '/*'
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  return pathname === pattern;
}
