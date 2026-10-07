import { layerOffInBrowser } from '@/v2/runtime/perf-switch';
import { isStaticAssetUrl, SW_CACHE_PREFIX, SW_PATH, SW_SCOPE, SW_WARM_MESSAGE } from './serve';

/**
 * The page side of the service worker (`lawexa-sw.js`). Browser only, no
 * React; `ServiceWorkerMount` calls it once from the v2 layout, so a v1 page
 * never registers anything.
 *
 * ── REGISTER LATE ──────────────────────────────────────────────────────────
 * After the page's `load` and an idle moment, so installing the worker never
 * competes with the first paint. `updateViaCache: 'none'` makes every update
 * check go to the server, which is what lets `/sw.js` swap in the
 * self-destruct worker the moment a browser leaves v2.
 *
 * ── WARMING ────────────────────────────────────────────────────────────────
 * On Chromium the worker's static route reads /_next/static/ from Cache
 * Storage without running the worker, so nothing inside the worker sees those
 * files arrive. The page tells it instead: every same-origin /_next/static/
 * file this page loaded (the browser's resource timing list, then each new
 * one) is posted to the worker in batches with the page's deploy id
 * (`<html data-dpl-id>`), and the worker copies them into its cache. This is
 * also what fills the cache on the very first visit, before the worker
 * controls the page.
 */

const noop = () => undefined;
const WARM_BATCH = 100;
const WARM_DELAY_MS = 1000;
const REMOVE_TIMEOUT_MS = 1500;

/** Same-origin /_next/static/ URLs among resource timing entries, each once. */
export function staticUrlsFrom(entries: readonly { name: string }[], origin: string): string[] {
  return [...new Set(entries.map((entry) => entry.name).filter((name) => isStaticAssetUrl(name, origin)))];
}

/** Splits a list into runs of at most `size`. */
export function inBatches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Whether a registration is this worker (and not, say, Firebase's push worker). */
function isOurs(registration: ServiceWorkerRegistration): boolean {
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  if (!worker) return new URL(registration.scope).pathname === SW_SCOPE;
  return new URL(worker.scriptURL).pathname === SW_PATH;
}

/**
 * Unregisters this worker and deletes its caches. Never throws and never takes
 * longer than `REMOVE_TIMEOUT_MS`, so a caller can wait for it before leaving
 * the page. Firebase's push worker is left alone.
 */
export function removeServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve();
  const work = (async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(isOurs).map((registration) => registration.unregister()));
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith(SW_CACHE_PREFIX)).map((name) => caches.delete(name)));
    }
  })().catch(noop);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, REMOVE_TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Posts the page's loaded /_next/static/ files to the active worker. Returns a stop function. */
function startWarming(): () => void {
  if (typeof PerformanceObserver === 'undefined') return noop;
  const origin = window.location.origin;
  const dpl = document.documentElement.dataset.dplId ?? '';
  const sent = new Set<string>();
  let pending: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const flush = () => {
    timer = undefined;
    const urls = pending;
    pending = [];
    if (stopped || urls.length === 0) return;
    void navigator.serviceWorker.ready.then((registration) => {
      const worker = registration.active;
      if (!worker || stopped) return;
      for (const batch of inBatches(urls, WARM_BATCH)) worker.postMessage({ type: SW_WARM_MESSAGE, dpl, urls: batch });
    });
  };

  const collect = (entries: readonly { name: string }[]) => {
    for (const url of staticUrlsFrom(entries, origin)) {
      if (sent.has(url)) continue;
      sent.add(url);
      pending.push(url);
    }
    if (pending.length > 0 && timer === undefined) timer = setTimeout(flush, WARM_DELAY_MS);
  };

  const observer = new PerformanceObserver((list) => collect(list.getEntries()));
  // `buffered` delivers the files the page loaded before this ran.
  observer.observe({ type: 'resource', buffered: true });

  return () => {
    stopped = true;
    observer.disconnect();
    if (timer !== undefined) clearTimeout(timer);
  };
}

/** Runs `run` after the page has loaded and the main thread is idle. Returns a cancel function. */
function afterLoadAndIdle(run: () => void): () => void {
  let idleId: number | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(run, { timeout: 5000 });
    else timeoutId = setTimeout(run, 1000);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
  return () => {
    window.removeEventListener('load', schedule);
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  };
}

/**
 * Registers the worker and starts warming, or removes it when the `sw` layer
 * is off. Returns a cleanup function for the effect that calls it.
 */
export function ensureServiceWorker(): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return noop;
  if (layerOffInBrowser('sw')) {
    void removeServiceWorker();
    return noop;
  }

  let stopped = false;
  let stopWarming: () => void = noop;
  const cancel = afterLoadAndIdle(() => {
    if (stopped) return;
    navigator.serviceWorker
      .register(SW_PATH, { scope: SW_SCOPE, updateViaCache: 'none' })
      .then(() => {
        if (!stopped) stopWarming = startWarming();
      })
      // Refused (private window, storage blocked): the page works as it does with no worker.
      .catch(noop);
  });

  return () => {
    stopped = true;
    cancel();
    stopWarming();
  };
}
