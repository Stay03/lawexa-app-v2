/* Lawexa v2 service worker: the fifth performance layer (`sw`, owner, 7 October 2026).
 *
 * It keeps the app's OWN CODE on the device: the files under /_next/static/
 * (scripts, styles, fonts), which Next names by content hash and serves as
 * `immutable`. Nothing else. HTML, RSC payloads and API answers carry the
 * reader's name, email and cases, and Cache Storage is per origin, not per
 * person, so a cached page would show one reader's data to the next person on
 * a shared device and outlive sign-out. Those requests are never answered here.
 *
 * Served by `app/sw.js/route.ts`, which sends this file only to a browser with
 * the v2 cookie and the `sw` layer on; everyone else gets the self-destruct
 * worker in `serve.ts`. Plain JS with no imports: the browser runs it as is.
 *
 * ── TWO WAYS A REQUEST IS ANSWERED ─────────────────────────────────────────
 * Chromium 123+ (`InstallEvent.addRoutes`): static routes. /_next/static/* is
 * read from Cache Storage without starting this worker (a miss goes to the
 * network), and every other path goes straight to the network, so a page load
 * or an API call never waits for the worker to boot. The cache is then filled
 * by the page (`register.ts` posts the URLs it loaded, see `warm`).
 *
 * Other browsers: the fetch handler below does the same cache-first lookup for
 * /_next/static/ only, and returns without answering for everything else.
 *
 * ── AFTER A DEPLOY ─────────────────────────────────────────────────────────
 * Every chunk URL carries `?dpl=<commit>`, so after a deploy every file has a
 * new URL. On Chromium the static route matches the exact URL only, so the
 * first open after a deploy downloads the files again, as it does with no
 * worker (measured 7 October 2026: a cached chunk under a new `dpl` came from
 * the network, 2,322 bytes); every open after that is served from the cache.
 * The fetch handler (other browsers) does better: a miss on the full URL looks
 * up the same path under an earlier `dpl` (same file name, same bytes, by
 * Next's content-hash naming) and serves that copy. Two generations are kept,
 * the current deploy and the one before, so a tab opened before a deploy can
 * still load its lazy chunks; older ones are deleted.
 *
 * A new version of this file activates at once (skipWaiting + clients.claim).
 * That is safe here because no page is cached: a page is never left running
 * against code it did not load.
 */

const CACHE = 'lawexa-static-v1';
const META = 'lawexa-sw-meta';
const META_KEY = '/__lawexa-sw-meta';
const STATIC_PREFIX = '/_next/static/';
const WARM_MESSAGE = 'lawexa:sw-warm';
const MAX_ENTRIES = 800;
const MAX_URLS_PER_MESSAGE = 200;

self.addEventListener('install', (event) => {
  if (typeof event.addRoutes === 'function') {
    // First match wins. Unspecified URL parts match anything, so `?dpl=` passes.
    event.waitUntil(
      event
        .addRoutes([
          { condition: { urlPattern: { pathname: '/_next/static/*' } }, source: { cacheName: CACHE } },
          { condition: { urlPattern: { pathname: '/*' } }, source: 'network' },
        ])
        .catch(() => undefined),
    );
  }
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // A schema change renames CACHE; the old name goes here.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('lawexa-') && name !== CACHE && name !== META)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(STATIC_PREFIX)) return;
  event.respondWith(serveStatic(request));
});

/** Only a whole, same-origin, successful answer is kept. */
function storable(response) {
  return response.ok && response.status === 200 && response.type === 'basic';
}

/** The copy under this exact URL, else the same file from an earlier deploy (stored under this URL too). */
async function cachedCopy(cache, request) {
  const exact = await cache.match(request);
  if (exact) return exact;
  const earlier = await cache.match(request, { ignoreSearch: true });
  if (!earlier) return undefined;
  await cache.put(request, earlier.clone());
  return earlier;
}

async function serveStatic(request) {
  let cache;
  try {
    cache = await caches.open(CACHE);
    const copy = await cachedCopy(cache, request);
    if (copy) return copy;
  } catch {
    // Storage refused or evicted: the network answers as if there were no worker.
  }
  const response = await fetch(request);
  if (cache && storable(response)) cache.put(request, response.clone()).catch(() => undefined);
  return response;
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== WARM_MESSAGE || !Array.isArray(data.urls)) return;
  const dpl = typeof data.dpl === 'string' ? data.dpl : '';
  const urls = data.urls.filter((u) => typeof u === 'string').slice(0, MAX_URLS_PER_MESSAGE);
  // One warm at a time, so two tabs cannot rotate the generations twice.
  warming = warming.then(() => warm(dpl, urls)).catch(() => undefined);
  event.waitUntil(warming);
});

let warming = Promise.resolve();

function dplOf(url) {
  return new URL(url).searchParams.get('dpl') ?? '';
}

/** Keep the current deploy and the one before it; delete the rest. */
async function rotate(cache, dpl) {
  if (!dpl) return;
  const meta = await caches.open(META);
  const stored = await meta.match(META_KEY);
  const state = stored ? await stored.json() : { current: '', previous: '' };
  if (state.current === dpl) return;
  const next = { current: dpl, previous: state.current };
  await meta.put(META_KEY, new Response(JSON.stringify(next), { headers: { 'Content-Type': 'application/json' } }));
  const keep = new Set([next.current, next.previous]);
  const keys = await cache.keys();
  await Promise.all(
    keys
      .filter((request) => {
        const generation = dplOf(request.url);
        return generation !== '' && !keep.has(generation);
      })
      .map((request) => cache.delete(request)),
  );
}

/** Copy the files the page loaded into the cache: from an earlier deploy if present, else from the HTTP cache. */
async function warm(dpl, urls) {
  const cache = await caches.open(CACHE);
  await rotate(cache, dpl);
  for (const href of urls) {
    const url = new URL(href, self.location.origin);
    if (url.origin !== self.location.origin || !url.pathname.startsWith(STATIC_PREFIX)) continue;
    const request = new Request(url.href);
    if (await cachedCopy(cache, request)) continue;
    try {
      // `force-cache`: these are already in the HTTP cache as immutable, so this reads the disk.
      const response = await fetch(request, { cache: 'force-cache' });
      if (storable(response)) await cache.put(request, response);
    } catch {
      // Offline or refused: the next load tries again.
    }
  }
  const keys = await cache.keys();
  if (keys.length > MAX_ENTRIES) {
    await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((request) => cache.delete(request)));
  }
}
