/**
 * The performance-layer test switches (owner, 7 October 2026): one cookie
 * that turns individual speed layers off, for this browser only, so a tester
 * can compare each layer on and off.
 *
 * The layers, and where each is checked:
 * - `ssr`   server-side rendering of case pages (`prefetchCaseDetailState`)
 * - `idb`   the IndexedDB query cache (`V2CacheIdentityGuard`)
 * - `route` route prefetch on hover or touch (`useIntentPrefetch`)
 * - `read`  the case read-ahead on hover (`useCaseRowIntent`)
 * - `sw`    the service worker that keeps the app's code on the device
 *           (`v2/runtime/sw/register.ts` in the browser, `app/sw.js/route.ts`
 *           on the server, which serves a worker that removes itself when off)
 * The Router Cache, the memory cache and the API's ETag stay as they are: a
 * reload and DevTools already cover those.
 *
 * A COOKIE, not localStorage, because the server must read it too. Its value
 * is the comma list of the layers that are OFF (`lawexa-perf=ssr,idb`).
 * Absent means every layer is on: a browser that never touched the switches
 * behaves exactly as before. The value `off` (the first, single switch of
 * 548f2c0) means every layer is off. Admins set it from Settings, Developer
 * (`/settings/developer`); nobody else sees the switches.
 *
 * NO REACT IMPORT HERE: the case page's server code reads the cookie through
 * this module, and Turbopack refuses a server component that imports a module
 * using client hooks. The hook lives in `use-perf-off.ts`.
 */
export const PERF_COOKIE = 'lawexa-perf';

export const PERF_LAYERS = ['ssr', 'idb', 'route', 'read', 'sw'] as const;
export type PerfLayer = (typeof PERF_LAYERS)[number];

/** One year, the same life as the v2 opt-in cookie. */
const PERF_COOKIE_MAX_AGE = 31536000;

/** The layers a cookie value turns off. */
export function layersOffIn(value: string | null | undefined): ReadonlySet<PerfLayer> {
  if (!value) return new Set();
  if (value === 'off') return new Set(PERF_LAYERS);
  const known = new Set<string>(PERF_LAYERS);
  return new Set(value.split(',').filter((part): part is PerfLayer => known.has(part)));
}

/** Is this layer off in this cookie value (as the server reads it)? */
export function layerOffValue(value: string | null | undefined, layer: PerfLayer): boolean {
  return layersOffIn(value).has(layer);
}

/** The cookie's value in a raw `document.cookie` string, or ''. */
export function perfValueInCookieString(cookieString: string): string {
  const entry = cookieString.split('; ').find((part) => part.startsWith(`${PERF_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(PERF_COOKIE.length + 1)) : '';
}

/** In the browser: the cookie's value, or ''. Always '' on the server. */
export function perfValueInBrowser(): string {
  return typeof document === 'undefined' ? '' : perfValueInCookieString(document.cookie);
}

/** In the browser: is this layer off? Always false on the server. */
export function layerOffInBrowser(layer: PerfLayer): boolean {
  return layersOffIn(perfValueInBrowser()).has(layer);
}

/** The cookie value after turning one layer on or off ('' when all are on). */
export function nextPerfValue(current: string, layer: PerfLayer, off: boolean): string {
  const set = new Set(layersOffIn(current));
  if (off) set.add(layer);
  else set.delete(layer);
  return PERF_LAYERS.filter((name) => set.has(name)).join(',');
}

/** Turn one layer on or off for this browser. All on clears the cookie. */
export function setLayerOff(layer: PerfLayer, off: boolean): void {
  const value = nextPerfValue(perfValueInBrowser(), layer, off);
  document.cookie = value
    ? `${PERF_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${PERF_COOKIE_MAX_AGE}; samesite=lax`
    : `${PERF_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Who sees the switches: the server-verified admin roles only. */
export function canUsePerfSwitch(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}
