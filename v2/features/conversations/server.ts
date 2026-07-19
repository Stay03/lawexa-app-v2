import 'server-only';
import { dehydrate, type DehydratedState } from '@tanstack/react-query';
import type { ConversationsListResponse } from '@/types/chat';
import { apiFetch } from '@/v2/runtime/api-server';
import { getServerQueryClient } from '@/v2/runtime/query';
import type { SessionUser } from '@/v2/runtime/session';
import { conversationsQueries, INFINITE_RECENTS_PARAMS } from './queries';

/**
 * conversations — server prefetch (wave-4 RSC hydration).
 *
 * THE SERVER-FETCH GAP. `conversationsQueries.infiniteRecents()` fetches via
 * `chatApi` (axios; its interceptor reads the browser localStorage token) — which
 * cannot run in an RSC. So this module fetches the SAME resource over the server DAL
 * ({@link apiFetch}: httpOnly session cookie → `Authorization: Bearer`, built and
 * kept server-side) and hydrates the EXACT SAME query key with the EXACT SAME shape.
 *
 * Shape parity is guaranteed structurally: both fetchers return the parsed Laravel
 * envelope typed `ConversationsListResponse` (`chatApi.listConversations` returns
 * `response.data`; `apiFetch` returns `response.json()` — same JSON body). Key parity
 * is guaranteed by reusing `infiniteRecents()`'s own `queryKey` /
 * `initialPageParam` / `getNextPageParam` here and overriding only the `queryFn`, and
 * by building the query string from the shared {@link INFINITE_RECENTS_PARAMS}.
 *
 * `import 'server-only'` keeps this (and `apiFetch`) out of every client bundle; the
 * dehydrated state it returns is plain serializable data that crosses to the client.
 */

/** Bound on the prefetch's serial TTFB cost: a hung conversations endpoint must
 *  not stall the whole /v2 shell. On timeout the fetch rejects, the query lands
 *  in error state, dehydration excludes it, and the client fetches normally. */
const PREFETCH_TIMEOUT_MS = 3000;

/** Fetch one recents page over the server DAL, mirroring `chatApi.listConversations`
 *  with the shared infinite-recents params. The query string is DERIVED from the
 *  shared constant (never hand-enumerated), so a future param added to
 *  `INFINITE_RECENTS_PARAMS` can't silently drift between the client fetcher and
 *  this one while the query key claims they match (review F2). */
function fetchRecentsPage(page: number): Promise<ConversationsListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(INFINITE_RECENTS_PARAMS)) {
    if (value !== undefined) query.set(key, String(value));
  }
  query.set('page', String(page));
  return apiFetch<ConversationsListResponse>(`/conversations?${query.toString()}`, {
    signal: AbortSignal.timeout(PREFETCH_TIMEOUT_MS),
  });
}

/**
 * Prefetch the FIRST page of the sidebar/drawer recents and return the dehydrated
 * cache for a `<HydrationBoundary>`, so a signed-in hard load paints real rows at
 * first paint (no skeleton flash) and the client `useInfiniteQuery` adopts the
 * hydrated page seamlessly.
 *
 *  - GUESTS (`user === null`): returns `undefined` — no fetch, nothing dehydrated,
 *    no server-only work. The client query stays gated on `enabled: signedIn`, so
 *    the shell behaves exactly as today.
 *  - AWAITED, not streamed: acceptance criterion (d) requires real rows in the
 *    first-paint HTML, which is only possible if the query is RESOLVED before render.
 *    The pending-dehydration path the query config supports would still paint a
 *    skeleton, so it is deliberately NOT used here. The cost is one `/conversations`
 *    round trip after the already-awaited `/auth/me`; it REPLACES the client mount
 *    fetch (the hydrated page is fresh within its 60s staleTime, so the client does
 *    not refetch), so it is not extra total work — just moved server-side.
 *  - FAILURE: graceful. `prefetchInfiniteQuery` does not reject on a fetch error — it
 *    leaves the query in error state, which `shouldDehydrateQuery` (success/pending
 *    only) then EXCLUDES, so the returned state simply carries no recents entry and
 *    the client fetches normally (skeleton → rows). The `try/catch` additionally
 *    guards any unexpected throw by returning `undefined`. The shell never crashes.
 */
export async function prefetchRecentsState(
  user: SessionUser | null,
): Promise<DehydratedState | undefined> {
  if (!user) return undefined;

  const queryClient = getServerQueryClient();
  const options = conversationsQueries.infiniteRecents();

  try {
    await queryClient.prefetchInfiniteQuery({
      queryKey: options.queryKey,
      queryFn: ({ pageParam }) => fetchRecentsPage(pageParam),
      initialPageParam: options.initialPageParam,
      getNextPageParam: options.getNextPageParam,
      staleTime: options.staleTime,
      // First page only — subsequent pages load client-side via the sentinel.
      pages: 1,
    });
  } catch {
    return undefined;
  }

  return dehydrate(queryClient);
}
