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
/**
 * `/bookmarks` is EXACT, not a wildcard — the page has no sub-routes, and any
 * deeper path should keep falling through to v1 rather than 404 in v2. It is a
 * private, per-account surface (noindex; guests included — guest bookmarks are
 * real and writable). `/quiz/*` covers the hub, player, results, history and
 * stats; private, open to every registered account in the UI (guests and bots
 * excluded), with the guest block on the server a pending backend ask. v1's `/quiz/play?s=` query-param
 * route shape deliberately dies here: the wildcard claims `/quiz/play` too,
 * where the `[sessionUuid]` segment treats "play" as an unknown session and the
 * player renders its designed error state — the same one-way door as radar's
 * `/settings`.
 */
/**
 * `/notes/*` covers the library, the note page, and authoring (`/create`,
 * `/{slug}/edit`); `/notes/mine` is claimed too and redirects into the
 * library's My Notes tab. The marketplace surfaces are NOT rebuilt — note
 * selling is out of scope for now — so they are carved out below and keep
 * falling through to v1.
 */
/**
 * `/folders/*` covers the library and every folder page. Private and
 * uuid-addressed: folder slugs are NOT unique (two folders may share one) and
 * a rename rewrites the whole subtree's paths, so the uuid v1 already used
 * stays the only honest address and no old link changes meaning. v1's public
 * "Explore" feed does not come along — v2 shows the viewer their own folders
 * only, and a public folder stays reachable by direct link.
 */
/**
 * THE COLLAB BLOCK (phase-5 W5). `/spaces/*`, `/channels/*`, `/invitations`
 * and `/organization` are the rebuilt Spaces experience: private, members-only
 * surfaces (every page is `noindex`; none joins the sitemap). Two of them are
 * new addresses rather than migrations — `/channels` 404'd in v1 (owner
 * decision D6 turned it into the "My channels" index) and `/organization`
 * moves the org home out from under v1's `/settings` (D7) — so, like `/work`
 * and `/study`, a link to either falls through to a v1 404 for a user without
 * the cookie. Accepted while v2 is a preview: only a v2 user can make one, and
 * the edge closes at cutover.
 *
 * `/invitations` is EXACT: the surface has no sub-routes, and the four v1
 * invitation URLs collapse onto it (D5).
 *
 * THE FOUR LEGACY REDIRECTS below are the compatibility half of D5 + D7. They
 * are listed here so the proxy rewrites them into `app/v2/`, where each is a
 * one-line server page that `redirect()`s to the new address. Cookie-scoped by
 * construction: a v1 user matches no manifest entry, so their four pages keep
 * serving byte-identically. They exist because old notification `action_url`s,
 * old emails and old bookmarks point at them — delete them only when the
 * backend has stopped emitting the old paths AND v1 is gone (phase 7).
 */
/**
 * `/settings` is EXACT, and that is the whole point of this entry.
 *
 * v2 claims the settings INDEX — the list of every option, in the row grammar
 * the owner settled on 16 August 2026 — and NOTHING under it. `/settings/profile`,
 * `/settings/billing`, `/settings/usage` and the rest keep falling through to
 * v1, unchanged, because they are real settings people need and a row that goes
 * nowhere is worse than one that goes to the page that works. Each joins this
 * list when it is rebuilt; the rows are already in
 * `v2/features/settings/rows.ts` and only their destination has to change.
 *
 * A wildcard here would swallow all thirteen v1 settings pages at once and
 * leave twelve of them 404ing in the v2 tree. `'/settings/organization'` below
 * stays where it is: it is the one settings path v2 already claimed, and it is
 * a redirect shell onto `/organization` (owner decision D7).
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
  '/bookmarks',
  '/quiz/*',
  '/notes/*',
  '/folders/*',
  '/spaces/*',
  '/channels/*',
  '/invitations',
  '/organization',
  // The settings INDEX only — exact, never a wildcard. See the block above.
  '/settings',
  // Legacy collab addresses — v2-only redirect shells (see the block above).
  '/channel-invitations',
  '/space-invitations',
  '/organization-invitations',
  '/settings/organization',
] as const;

/**
 * Carve-outs from the wildcards above: a path matching an entry here falls
 * through to v1 even though a `V2_ROUTES` wildcard covers it. Exclusions
 * support one extra pattern form — a lone `*` segment matches exactly ONE
 * path segment (so the third entry below matches `/notes/foo/publish` but
 * not `/notes/publish` or `/notes/a/b/publish`; the star sequence cannot be
 * quoted here without closing this comment). Trailing `/*` keeps its
 * subtree meaning.
 *
 * The notes carve-outs are the v1 marketplace: publish flows, purchases, and
 * the export-docx trigger page (v2's reader exports with a button instead of
 * a route). Remove them when the marketplace is rebuilt or retired.
 */
export const V2_ROUTE_EXCLUSIONS = [
  '/notes/publish',
  '/notes/purchases',
  '/notes/*/publish',
  '/notes/*/export-docx',
] as const;

export type V2Route = (typeof V2_ROUTES)[number];

/**
 * Whether `pathname` has been migrated to v2. Exact entries match the path
 * verbatim; `'/prefix/*'` entries match the prefix and everything below it.
 * Exclusions are checked first and always win over inclusions.
 */
export function isMigratedToV2(pathname: string): boolean {
  if (V2_ROUTE_EXCLUSIONS.some((pattern) => matchesRoute(pattern, pathname))) {
    return false;
  }
  return V2_ROUTES.some((pattern) => matchesRoute(pattern, pathname));
}

/**
 * Match a single manifest pattern against a pathname. A trailing `/*` turns the
 * entry into a prefix match (covering the prefix itself and any descendant);
 * a lone `*` SEGMENT matches exactly one path segment; every other entry —
 * including `'/'` — is an exact match.
 */
function matchesRoute(pattern: string, pathname: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2); // drop the trailing '/*'
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  if (pattern.includes('/*/')) {
    const patternSegments = pattern.split('/');
    const pathSegments = pathname.split('/');
    if (patternSegments.length !== pathSegments.length) return false;
    return patternSegments.every(
      (segment, i) => segment === '*' || segment === pathSegments[i],
    );
  }
  return pathname === pattern;
}
