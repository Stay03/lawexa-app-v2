import 'server-only';
import { dehydrate, type DehydratedState } from '@tanstack/react-query';
import type { CaseListParams, CaseListResponse } from '@/types/case';
import { apiFetch } from '@/v2/runtime/api-server';
import { verifySession } from '@/v2/runtime/session';
import { makeQueryClient } from '@/v2/runtime/query';
import { CASES_PAGE_SIZE, casesQueries } from './queries';

/**
 * cases — the server half of the feature: the SEO read and the list prefetch.
 *
 * THE SERVER-FETCH GAP (same as `conversations/server.ts`). `casesQueries.*`
 * fetch through `lib/api/cases.ts`, whose axios interceptor reads the browser's
 * localStorage token — it cannot run in an RSC. So this module fetches the same
 * resource over the server DAL (`apiFetch`: httpOnly session cookie →
 * `Authorization: Bearer`, built and kept server-side) and hydrates the EXACT
 * same query key with the EXACT same shape. Key parity is guaranteed by reading
 * the params back off the leaf's own key rather than re-declaring them.
 *
 * `import 'server-only'` keeps this and `apiFetch` out of every client bundle.
 */

/** Bound on the prefetch's TTFB cost — a slow list must not stall the route. */
const PREFETCH_TIMEOUT_MS = 3000;

/**
 * THE SEO READ LIVES IN `lib/api/server.ts`, not here.
 *
 * `fetchCaseForMetadata` is shared with `app/api/og/cases/[slug]`, which is
 * OUTSIDE the v2 tree — and the reverse import boundary forbids v1 code reaching
 * into `v2/`. Putting it in the shared server data layer, beside
 * `fetchConversationForMetadata`, is what lets the page's `generateMetadata` and
 * its OG card read through the same function and therefore never disagree.
 */

/* ──────────────────────────── list prefetch ─────────────────────────────── */

/** Serialize params exactly as axios does for the client fetcher, so the request
 *  this makes and the request the hydrated query would have made cannot drift. */
function fetchCasesPage(params: CaseListParams): Promise<CaseListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return apiFetch<CaseListResponse>(`/cases?${query.toString()}`, {
    signal: AbortSignal.timeout(PREFETCH_TIMEOUT_MS),
  });
}

/**
 * Prefetch page 1 of the browse list and return the dehydrated cache for the
 * page's `<HydrationBoundary>`.
 *
 * AWAITED, NOT STREAMED. `/cases` is the reader's entry into the library and the
 * rows are the page, so they belong in the first-paint HTML: the streaming
 * alternative (non-blocking prefetch + pending dehydration) paints the skeleton
 * anyway, which gives up the only thing this buys. The cost is bounded by
 * `PREFETCH_TIMEOUT_MS` and paid only on a hard load; a soft navigation back
 * reuses the router segment (`unstable_dynamicStaleTime`).
 *
 * SIGNED-OUT VISITORS ARE SKIPPED, and that is a fact about the API, not a
 * choice. Measured July 25, 2026: `GET /api/cases` with no bearer token returns
 * **401 Unauthenticated** — the library list is not public. (v1 hides this by
 * minting a GUEST token for every visitor via `useGuestAuth`; v2 has no
 * equivalent yet, which is recorded as a gap in the phase-4 plan.) So there is
 * no crawler path to prefetch for, and firing the request anyway would buy one
 * guaranteed 401 per signed-out request.
 *
 * NEVER THROWS. It is awaited inside the page, so an escape would take the whole
 * route down rather than degrading to a client-side fetch. On any failure the
 * query is simply absent from the dehydrated state and the client fetches
 * normally, behind the list's own skeleton.
 */
export async function prefetchCasesListState(
  params: Omit<CaseListParams, 'page' | 'per_page'> = {},
): Promise<DehydratedState | undefined> {
  try {
    const session = await verifySession();
    if (!session) return undefined;
    const viewerId = session.user.id;

    const leaf = casesQueries.infiniteList({ ...params, viewerId });
    // The request params are the SECOND-TO-LAST key segment (`infiniteList`
    // builds the key as [...lists(), 'infinite', params, { viewerId }]). Reading
    // them back off the key — rather than re-declaring them — is what makes the
    // request and the entry it hydrates provably the same query.
    const keyParams = leaf.queryKey[3];

    const page = await fetchCasesPage({
      ...keyParams,
      per_page: CASES_PAGE_SIZE,
      page: 1,
    });

    // A FRESH client, not the request-shared `getServerQueryClient()`.
    //
    // The layout dehydrates that shared client for the sidebar recents. Writing
    // this list into it too would put both features' data in BOTH boundaries —
    // the conversations recents serialized a second time into every `/cases`
    // document, and this list serialized into the layout's payload depending on
    // which render finished first. An isolated client makes each boundary carry
    // exactly what its own segment fetched. `makeQueryClient()` (not a bare
    // `new QueryClient()`) so the v2 dehydrate configuration still applies.
    const queryClient = makeQueryClient();
    queryClient.setQueryData(leaf.queryKey, { pages: [page], pageParams: [1] });
    return dehydrate(queryClient);
  } catch {
    return undefined;
  }
}
