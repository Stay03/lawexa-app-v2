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
export const V2_ROUTES = ['/', '/c/*', '/conversations'] as const;

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
