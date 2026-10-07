/**
 * The speed-features test switch (owner, 7 October 2026): one cookie that
 * turns off, for this browser only, the parts of v2 that make pages appear
 * sooner, so a tester can compare with and without them.
 *
 * Off means: no server-built case page (`prefetchCaseDetailState`), no device
 * cache (`V2CacheIdentityGuard`), and no prefetch on intent
 * (`useIntentPrefetch`, which carries both the route prefetch and the case
 * read ahead). The Router Cache, the memory cache and the API's ETag stay as
 * they are: a reload and DevTools already cover those.
 *
 * A COOKIE, not localStorage, because the server must read it too. Absent, or
 * any value but `off`, means on: a browser that never touched the switch
 * behaves exactly as before. Admins set it from Settings, Developer
 * (`/settings/developer`); nobody else sees the switch.
 *
 * NO REACT IMPORT HERE: the case page's server code reads the cookie through
 * this module, and Turbopack refuses a server component that imports a module
 * using client hooks. The hook lives in `use-perf-off.ts`.
 */
export const PERF_COOKIE = 'lawexa-perf';

/** One year, the same life as the v2 opt-in cookie. */
const PERF_COOKIE_MAX_AGE = 31536000;

/** Is the switch off in this cookie value (as the server reads it)? */
export function perfOffValue(value: string | null | undefined): boolean {
  return value === 'off';
}

/** Is the switch off in a raw `document.cookie` string? Exact-entry match. */
export function perfOffInCookieString(cookieString: string): boolean {
  return cookieString.split('; ').some((entry) => entry === `${PERF_COOKIE}=off`);
}

/** In the browser: is the switch off? Always false on the server. */
export function perfOffInBrowser(): boolean {
  return typeof document !== 'undefined' && perfOffInCookieString(document.cookie);
}

/** Turn the speed features on or off for this browser. */
export function setPerfOff(off: boolean): void {
  document.cookie = off
    ? `${PERF_COOKIE}=off; path=/; max-age=${PERF_COOKIE_MAX_AGE}; samesite=lax`
    : `${PERF_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Who sees the switch: the server-verified admin roles only. */
export function canUsePerfSwitch(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}
