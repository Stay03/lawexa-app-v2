import { UI_COOKIE, V2_COOKIE_VALUE } from '@/v2/cookie';
import { layerOffValue, PERF_COOKIE } from '@/v2/runtime/perf-switch';

/**
 * The service worker's contract, shared by its route (`app/sw.js/route.ts`,
 * server) and its registration (`register.ts`, browser). Pure: no React, no
 * DOM, so the route can import it.
 *
 * ── WHO GETS THE REAL WORKER ───────────────────────────────────────────────
 * Only a browser inside v2 (`lawexa-ui=v2`) with the `sw` layer on, while v2
 * is enabled and the operator has not turned the worker off (`LAWEXA_SW=off`
 * in the server's environment). Everyone else asking for /sw.js gets
 * `SELF_DESTRUCT_SOURCE`, which deletes the worker's caches and unregisters.
 *
 * The browser fetches /sw.js with the page's cookies on every navigation and
 * skips the HTTP cache for it, so a browser that leaves v2, or turns the layer
 * off, or that the operator switches off, drops the worker on its next page
 * load without any v2 code running. A v1 page never registers a worker, so a
 * v1 browser that never opted in never asks for /sw.js at all.
 *
 * Why not a 404 to remove it: a failed update keeps the old registration
 * (Service Workers spec, Update), so removal has to be a worker that removes
 * itself.
 */

export const SW_PATH = '/sw.js';
export const SW_SCOPE = '/';
/** Every Cache Storage cache the worker owns starts with this. */
export const SW_CACHE_PREFIX = 'lawexa-';
export const SW_WARM_MESSAGE = 'lawexa:sw-warm';
/** Server environment variable: `off` gives every browser the self-destruct worker. */
export const SW_ENV = 'LAWEXA_SW';

const STATIC_PREFIX = '/_next/static/';

/** The worker that removes the worker: no fetch handler, so it answers nothing. */
export const SELF_DESTRUCT_SOURCE = `/* Lawexa service worker, switched off for this browser: removes itself. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('${SW_CACHE_PREFIX}')).map((name) => caches.delete(name)));
    await self.registration.unregister();
  })());
});
`;

export interface WorkerGate {
  /** The `lawexa-ui` cookie's value. */
  uiCookie: string | undefined;
  /** The `lawexa-perf` cookie's value. */
  perfValue: string | undefined;
  /** `V2_ENABLED === 'true'` on the server. */
  v2Enabled: boolean;
  /** The server's `LAWEXA_SW` value. */
  swSetting: string | undefined;
}

/** Whether this browser should run the real worker. */
export function serviceWorkerWanted(gate: WorkerGate): boolean {
  return (
    gate.v2Enabled &&
    gate.swSetting !== 'off' &&
    gate.uiCookie === V2_COOKIE_VALUE &&
    !layerOffValue(gate.perfValue, 'sw')
  );
}

/** The body /sw.js answers with: the real worker or the one that removes it. */
export function serviceWorkerBodyFor(gate: WorkerGate, workerSource: string): string {
  return serviceWorkerWanted(gate) ? workerSource : SELF_DESTRUCT_SOURCE;
}

/** The cookie names the route reads, from their single definitions. */
export const SW_GATE_COOKIES = { ui: UI_COOKIE, perf: PERF_COOKIE } as const;

/** A same-origin file under /_next/static/: the only thing the worker keeps. */
export function isStaticAssetUrl(href: string, origin: string): boolean {
  try {
    const url = new URL(href, origin);
    return url.origin === origin && url.pathname.startsWith(STATIC_PREFIX);
  } catch {
    return false;
  }
}
