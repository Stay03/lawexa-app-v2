import 'server-only';
import { dehydrate, type DehydratedState } from '@tanstack/react-query';
import { STATUTE_COUNTRIES_FALLBACK } from '@/lib/constants/statute-countries';
import type {
  StatuteCountriesData,
  StatuteDetail,
  StatuteDetailResponse,
  StatuteFacetsResponse,
  StatuteListParams,
  StatuteListResponse,
} from '@/types/statute';
import { apiFetch } from '@/v2/runtime/api-server';
import { verifySession } from '@/v2/runtime/session';
import { makeQueryClient } from '@/v2/runtime/query';
import { STATUTES_PAGE_SIZE, statutesQueries } from './queries';
import { resolveCountryId } from './statute-row-model';

/**
 * statutes — the server half of the feature: the list prefetch and the SEO
 * read. Same shape and same reasoning as `v2/features/cases/server.ts` (the
 * server-fetch gap: `statutesQueries.*` fetch through the axios client, whose
 * interceptor reads the browser's localStorage token — it cannot run in an
 * RSC — so this module fetches the same resources over the server DAL and
 * hydrates the EXACT same query keys with the EXACT same shapes).
 */

/** Bound on each prefetch call's TTFB cost — a slow API must not stall the route. */
const PREFETCH_TIMEOUT_MS = 3000;

/* ──────────────────────────── list prefetch ─────────────────────────────── */

/** Serialize params exactly as axios does for the client fetcher, so the request
 *  this makes and the request the hydrated query would have made cannot drift. */
function fetchStatutesPage(params: StatuteListParams): Promise<StatuteListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return apiFetch<StatuteListResponse>(`/statutes?${query.toString()}`, {
    signal: AbortSignal.timeout(PREFETCH_TIMEOUT_MS),
  });
}

/**
 * The same facets source chain the client's countries query uses (live
 * endpoint → seed), so the server's slug→id resolution and the client's can
 * only disagree during the one render in which the endpoint first ships.
 * `GET /statutes/countries` is a 404 today (measured July 31, 2026), so in
 * practice this resolves from the seed without a wasted wait — the timeout
 * only bounds the day it starts answering slowly.
 */
async function fetchCountryFacets(): Promise<StatuteCountriesData> {
  try {
    const res = await apiFetch<StatuteFacetsResponse>('/statutes/countries', {
      signal: AbortSignal.timeout(PREFETCH_TIMEOUT_MS),
    });
    return res.data;
  } catch {
    return STATUTE_COUNTRIES_FALLBACK;
  }
}

/**
 * Prefetch page 1 of the statute library and return the dehydrated cache for
 * the page's `<HydrationBoundary>`.
 *
 * AWAITED, NOT STREAMED — `/statutes` is a public, indexed surface and the
 * rows are the page, so they belong in the first-paint HTML (the cases-list
 * argument, verbatim). Cost is bounded by `PREFETCH_TIMEOUT_MS`, paid only on
 * a hard load.
 *
 * SIGNED-OUT VISITORS ARE SKIPPED, and that is a fact about the API, not a
 * choice: measured July 31, 2026, `GET /api/statutes` answers **401** without
 * a bearer token (a guest TOKEN reads it; no token does not). No session ⇒ no
 * request whose answer we already know.
 *
 * `countrySlug` is the URL's country tab; it resolves to the numeric id the
 * API filters by through the same `resolveCountryId` seam the client uses, so
 * the prefetched key and the key the browser reads are provably the same.
 *
 * NEVER THROWS — on any failure the entry is simply absent and the client
 * fetches normally behind the list's own skeleton.
 */
export async function prefetchStatutesListState({
  search,
  countrySlug,
}: {
  search?: string;
  countrySlug?: string;
}): Promise<DehydratedState | undefined> {
  try {
    const session = await verifySession();
    if (!session) return undefined;
    const viewerId = session.user.id;

    const country = countrySlug
      ? resolveCountryId(await fetchCountryFacets(), countrySlug)
      : undefined;

    const leaf = statutesQueries.infiniteList({ search, country, viewerId });
    // The request params are read back off the leaf's own key (segment 3 —
    // `infiniteList` builds `[...lists(), 'infinite', params, { viewerId }]`)
    // rather than re-declared, so the request and the entry it hydrates are
    // provably the same query.
    const keyParams = leaf.queryKey[3];

    const page = await fetchStatutesPage({
      ...keyParams,
      per_page: STATUTES_PAGE_SIZE,
      page: 1,
    });

    // A FRESH client, not the request-shared `getServerQueryClient()` — the
    // layout dehydrates that one for the sidebar recents, and mixing features
    // into one client serializes both payloads into both boundaries (the
    // cases-list note carries the full argument).
    const queryClient = makeQueryClient();
    queryClient.setQueryData(leaf.queryKey, { pages: [page], pageParams: [1] });
    return dehydrate(queryClient);
  } catch {
    return undefined;
  }
}

/* ──────────────────────────── the SEO read ──────────────────────────────── */

/** The statute fields `generateMetadata` actually uses. */
export interface StatuteMetadata {
  title: string;
  shortTitle: string | null;
  country: string | null;
  year: number;
  status: StatuteDetail['status'];
  /** One-line description material, already collapsed and capped. */
  summary: string;
}

/** Collapse whitespace to a plain single-line blurb, capped for a card. */
function toBlurb(value: string | null | undefined, max: number): string {
  if (!value) return '';
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '').trimEnd()}…`;
}

/**
 * Server-side statute fetcher for `generateMetadata`.
 *
 * UNLIKE `fetchCaseForMetadata`, this read goes through the session DAL
 * (`apiFetch`, `cache: 'no-store'`) and NOT an unauthenticated shared-cache
 * fetch — because it cannot: `GET /statutes/{slug}` answers 401 without a
 * bearer token (measured July 31, 2026). The consequences are accepted and
 * honest:
 *
 *  - a signed-in (or guest-cookied) reader's hard load emits full metadata;
 *  - a crawler or signed-out visitor gets the site-default card — which is
 *    exactly what they could read anyway, since the data is auth-walled;
 *  - the response is per-session and is therefore NEVER placed in Next's
 *    shared data cache (a per-user payload cached across users would be the
 *    privacy defect the cases note warns about).
 *
 * A public statute read is on the backend-asks list; the day it ships, this
 * function switches to the cases pattern and crawlers get real cards.
 *
 * Returns `null` for anything that is not a readable statute (404, 401,
 * timeout, network failure) so callers fall back to the site default.
 */
export async function fetchStatuteForMetadata(
  slug: string,
): Promise<StatuteMetadata | null> {
  try {
    const res = await apiFetch<StatuteDetailResponse>(
      `/statutes/${encodeURIComponent(slug)}`,
      { signal: AbortSignal.timeout(PREFETCH_TIMEOUT_MS) },
    );
    const data = res.data;
    if (!res.success || !data) return null;

    return {
      title: data.title,
      shortTitle:
        data.short_title && data.short_title !== data.title
          ? data.short_title
          : null,
      country: data.country?.name ?? null,
      year: data.year,
      status: data.status,
      summary: toBlurb(
        data.description || data.long_title || data.preamble,
        300,
      ),
    };
  } catch {
    return null;
  }
}
