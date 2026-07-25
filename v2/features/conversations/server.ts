import 'server-only';
import { dehydrate, type DehydratedState } from '@tanstack/react-query';
import type { ConversationsListResponse, ListConversationsParams } from '@/types/chat';
import { apiFetch } from '@/v2/runtime/api-server';
import { getSessionToken } from '@/v2/runtime/session-token';
import { verifySession } from '@/v2/runtime/session';
import { getServerQueryClient } from '@/v2/runtime/query';
import { conversationsQueries, INFINITE_RECENTS_PARAMS } from './queries';

/**
 * conversations — server prefetch (wave-4 RSC hydration).
 *
 * THE SERVER-FETCH GAP. `conversationsQueries.*` fetch via `chatApi` (axios; its
 * interceptor reads the browser localStorage token) — which cannot run in an RSC. So
 * this module fetches the SAME resources over the server DAL ({@link apiFetch}: httpOnly
 * session cookie → `Authorization: Bearer`, built and kept server-side) and hydrates the
 * EXACT SAME query keys with the EXACT SAME shapes.
 *
 * Shape parity is guaranteed structurally: both fetchers return the parsed Laravel
 * envelope typed `ConversationsListResponse` (`chatApi.listConversations` returns
 * `response.data`; `apiFetch` returns `response.json()` — same JSON body). Key parity
 * is guaranteed by reusing each leaf's own `queryKey` / `initialPageParam` /
 * `getNextPageParam` here and overriding only the `queryFn`, and by DERIVING every query
 * string from the same params object that formed the key (never hand-enumerated).
 *
 * `import 'server-only'` keeps this (and `apiFetch`) out of every client bundle; the
 * dehydrated state it returns is plain serializable data that crosses to the client.
 */

/** Bound on the prefetch's TTFB cost: a hung conversations endpoint must not stall
 *  the whole /v2 shell. On timeout the fetch rejects, the query lands in error state,
 *  dehydration excludes it, and the client fetches normally. */
const PREFETCH_TIMEOUT_MS = 3000;

/**
 * Fetch a conversations list over the server DAL, mirroring `chatApi.listConversations`
 * exactly: it takes the SAME params object the client fetcher would pass and serializes
 * it the same way axios does (`{ params }` — every defined key, nothing else). Callers
 * therefore hand it the literal argument their client counterpart uses, so the request
 * this makes and the request the hydrated query would have made cannot drift, even in
 * which keys are present (review F2).
 */
function fetchConversationsPage(
  params: ListConversationsParams,
): Promise<ConversationsListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return apiFetch<ConversationsListResponse>(`/conversations?${query.toString()}`, {
    signal: AbortSignal.timeout(PREFETCH_TIMEOUT_MS),
  });
}

/**
 * Prefetch BOTH conversation-list entries the v2 shell reads on a hard load, and return
 * the dehydrated cache for a single `<HydrationBoundary>`:
 *
 *  1. `infiniteRecents()` — the sidebar + drawer Recents (`per_page 20`, infinite). Real
 *     rows in the first-paint HTML instead of a skeleton flash.
 *  2. `recents()` — the home's recent-conversation PEEK (`per_page 10`, single page),
 *     read by the Work tab's `RecentConversationsModule` and the Study tab's
 *     `RecentConversations`. A DIFFERENT query key from (1), so before this the home
 *     always re-fetched client-side a strict subset of data the server already had.
 *
 * Both land in the ONE React-`cache()`d server QueryClient and dehydrate together, so
 * the layout's single `<HydrationBoundary>` seeds both keys.
 *
 * CONCURRENT, not serial. The two requests are issued together, and the layout runs this
 * whole function concurrently with `verifySession()` — the id is needed only at the
 * WRITE, after every response is in hand. Historically this is why it no longer needs
 * the verified user (below) and why the shell's server round trips overlap instead of
 * stacking. TTFB is the slowest single request, not their sum.
 *
 * (2) IS DELIBERATELY OVER-FETCHED — the honest trade. This runs in the LAYOUT, which has
 * no way to know the route (layouts receive no pathname, by design, because they do not
 * re-render on navigation). So the peek is fetched on hard loads of `/v2`, `/conversations`
 * AND `/c/{id}`, while its only consumers mount on the HOME and only on the Work or Study
 * tab. On `/c/{id}`, on `/conversations`, and on the home's default Chat tab it is
 * genuinely wasted: one small backend request plus ~10 records serialized into that
 * document's HTML. Concurrency hides the LATENCY but not that cost — this is backend load
 * and payload, and calling it free would be wrong.
 *
 * It is still the right call, because every alternative is worse:
 *   - Prefetching it from `app/v2/page.tsx` instead would restore a blocking `await` on
 *     the home page segment — the exact defect (a skeleton on every navigation) that the
 *     session rework removed.
 *   - Doing that non-blockingly, via the pending-dehydration path the query config
 *     supports, gives up the whole point: the rows would arrive after paint, i.e. the
 *     skeleton is back anyway, for far more machinery.
 *   - Synthesising the peek from (1)'s first page (its 10 newest rows ARE a prefix of
 *     (1)'s 20) would save the request but not the payload, and would mean fabricating a
 *     `pagination` envelope the API never sent — a cache entry that lies about its
 *     provenance.
 * The cost is bounded (hard loads only — the layout renders once per full page load, not
 * per navigation) and it buys a removed client round trip on the home, the most-visited
 * route, for the Work/Study tabs that a returning user's persisted tab choice lands on.
 * If a future route-scoped prefetch seam appears, (2) belongs behind it.
 *
 *  - GUESTS: the cookie check below returns `undefined` — no fetch, nothing dehydrated,
 *    no server-only work. The client queries stay gated on `enabled: signedIn` / are
 *    never mounted, so the shell behaves exactly as today.
 *  - AWAITED, not streamed: acceptance criterion (d) requires real rows in the
 *    first-paint HTML, which is only possible if the queries are RESOLVED before render.
 *    The pending-dehydration path the query config supports would still paint a
 *    skeleton, so it is deliberately NOT used here. The cost REPLACES the client mount
 *    fetches (the hydrated pages are fresh within their 60s staleTime, so the client
 *    does not refetch) — not extra total work, just moved server-side.
 *  - FAILURE: graceful, and independent per query. `prefetch*Query` does not reject on a
 *    fetch error — it leaves the query in error state, which `shouldDehydrateQuery`
 *    (success/pending only) then EXCLUDES. `allSettled` additionally guarantees that an
 *    unexpected throw from one prefetch cannot discard the other's resolved data. And the
 *    try/catch spans EVERYTHING, including the cookie read: this function is awaited
 *    inside the layout's `Promise.all`, so anything it lets escape would take the whole
 *    v2 shell down rather than degrading to a client-side fetch. It never throws.
 */
export async function prefetchRecentsState(): Promise<DehydratedState | undefined> {
  try {
    // Cookie PRESENCE only — a zero-network read, and deliberately not a verified session:
    // it answers "is it worth ATTEMPTING a prefetch?", never "is this user authorized?"
    // (the backend authorizes each request itself). A stale or revoked token simply 401s
    // into the failure path, which is the same `undefined`-shaped outcome the guest branch
    // produces. Checking the cookie instead of awaiting `verifySession()` is what lets the
    // layout run this CONCURRENTLY with its own session verification.
    const token = await getSessionToken();
    if (!token) return undefined;

    const queryClient = getServerQueryClient();
    // A throwaway instance built only to READ the params back off its key — the
    // viewer is irrelevant here and is supplied properly at the write below.
    const peek = conversationsQueries.recents({ viewerId: null });
    // The peek's params object is the SECOND-TO-LAST segment of its own key
    // (`list()` builds it as `[...lists(), params, { viewerId }]`). Reading it back
    // off the key — rather than re-declaring it — is what makes the request and the
    // entry it hydrates provably the same query.
    const peekParams = peek.queryKey[2];

    // ── PARTITIONED, AND STILL CONCURRENT. ──
    // The list keys now carry the viewer id (`ViewerScoped`), so this prefetch needs
    // the verified user before it can decide WHERE to store what it fetched. Awaiting
    // that first would put `/auth/me` in front of `/conversations` again and undo the
    // TTFB win of running them together. So all three go out at once and the id is
    // only needed at the WRITE, which is after every response is in hand anyway.
    //
    // `verifySession()` is React-`cache()`d, so this shares the layout's single
    // `/auth/me` round trip rather than adding one.
    const [session, infinitePage, peekPage] = await Promise.all([
      verifySession(),
      fetchConversationsPage({ ...INFINITE_RECENTS_PARAMS, page: 1 }),
      fetchConversationsPage(peekParams),
    ]);

    // A cookie that no longer resolves to a user: hydrate nothing. Writing under a
    // `null` partition would seed the GUEST entry with a signed-in user's rows.
    if (!session) return undefined;
    const viewerId = session.user.id;

    queryClient.setQueryData(
      conversationsQueries.infiniteRecents({ viewerId }).queryKey,
      // First page only — subsequent pages load client-side via the sentinel. The
      // shape must match what `useInfiniteQuery` expects, since this replaces the
      // former `prefetchInfiniteQuery` (which cannot be used now: the key depends on
      // a value that is not known until after the fetch).
      { pages: [infinitePage], pageParams: [1] },
    );
    queryClient.setQueryData(
      conversationsQueries.recents({ viewerId }).queryKey,
      peekPage,
    );

    return dehydrate(queryClient);
  } catch {
    return undefined;
  }
}
