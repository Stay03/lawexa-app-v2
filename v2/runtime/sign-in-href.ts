/** The sign-in page, returning to `path` (the app's public form, `/v2` dropped). */
export function signInHref(path: string): string {
  const back = path.startsWith('/v2/') ? path.slice(3) : path === '/v2' ? '/' : path;
  return `/login?redirect=${encodeURIComponent(back)}`;
}

/**
 * `path` with the visit's referral code kept (`?ref=`), so the page a person
 * returns to after signing in is the link they were given, code included
 * (Lucy's walk, 16 November 2026). The credit itself never depended on it: the
 * code is held from the first visit (lib/utils/attribution.ts). Only a plain
 * code is kept.
 */
export function keepRef(path: string, ref: string | null): string {
  if (!ref || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`;
}
