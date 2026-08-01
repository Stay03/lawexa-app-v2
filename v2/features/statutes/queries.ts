import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { statutesApi } from '@/lib/api/statutes';
import { STATUTE_COUNTRIES_FALLBACK } from '@/lib/constants/statute-countries';
import type { StatuteCountriesData, StatuteListParams } from '@/types/statute';
import { GC_TIMES, STALE_TIMES } from '@/v2/runtime/query';

/**
 * statutes query policy — the `v2/features/cases/queries.ts` exemplar, applied
 * to the statute library: a hierarchical key factory whose leaves are
 * `queryOptions()` objects, wrapping the shared `lib/api/statutes.ts` fetchers
 * unchanged. No inline keys anywhere; no bespoke `useStatutes`-style hooks.
 *
 * `enabled` is a call-site concern, never baked into a leaf. That matters more
 * here than usual: MEASURED July 31, 2026, every statute endpoint (list, show,
 * export-akn) answers **401 Unauthenticated** without a bearer token — "guest-
 * readable" means a guest TOKEN reads them, not that no token does. So every
 * consumer gates on the session exactly as the cases list does, and the
 * signed-out visitor gets a designed sign-in state instead of a network error.
 *
 * ── DATA CLASSES (the staleTime argument, per query) ─────────────────────────
 * The whole feature is REFERENCE data: our editors add statutes on a cadence of
 * days, nobody publishes one from another tab, and the one per-user field
 * (`is_bookmarked`) is written straight into these caches by the bookmark
 * mutation. So the reference tier (10 min stale / 30 min gc) is the honest
 * lever everywhere, and `REFETCH_ON_VISIT` has nothing to announce — the same
 * reasoning `casesQueries` documents at length.
 *
 * The AKN document is the strongest case of all: a statute's XML changes only
 * when the law itself is re-imported. Its entry is large (275 KB for a 719-node
 * Act — measured), so the reference gcTime is also a deliberate memory bound:
 * a session holds the last few documents read, not every one ever opened.
 */

/** The list page size — shared by the client query and the RSC prefetch, so
 *  the server-hydrated entry and the client's first request are one key. */
export const STATUTES_PAGE_SIZE = 15;

/**
 * The list's viewer partition. `is_bookmarked` is per-user, so a cached page
 * of statutes belongs to the account that fetched it — same rule and same
 * reasoning as `casesQueries.ViewerScoped`. Required, not optional.
 */
export interface ViewerScoped {
  viewerId: number | null;
}

/** What the country tabs consume: the facets plus WHERE they came from —
 *  `'live'` from the backend endpoint, `'seed'` from the static fallback. */
export interface StatuteCountries extends StatuteCountriesData {
  source: 'live' | 'seed';
}

/**
 * The seed facets as a FIRST-FRAME placeholder (a module constant, so every
 * call site shares one referentially-stable object). The tabs are chrome — a
 * filter row that pops in after the list would move the page — and the seed
 * mirrors production, so painting it while the real fetch resolves shows the
 * right tabs immediately in practice.
 */
export const STATUTE_COUNTRIES_PLACEHOLDER: StatuteCountries = {
  ...STATUTE_COUNTRIES_FALLBACK,
  source: 'seed',
};

export const statutesQueries = {
  all: ['statutes'] as const,

  lists: () => [...statutesQueries.all, 'list'] as const,

  /**
   * The `/statutes` browse list. Reference tier; the long gcTime also
   * preserves loaded pages (and therefore scroll position) across an
   * intra-session detour into a statute and back.
   */
  infiniteList: ({
    viewerId,
    ...params
  }: Omit<StatuteListParams, 'page' | 'per_page'> & ViewerScoped) =>
    infiniteQueryOptions({
      queryKey: [
        ...statutesQueries.lists(),
        'infinite',
        params,
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        statutesApi.getList({
          ...params,
          per_page: STATUTES_PAGE_SIZE,
          page: pageParam,
        }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.list,
    }),

  /**
   * The country facets behind the tabs — live endpoint first, seed fallback.
   *
   * `GET /statutes/countries` is still a 404 (measured July 31, 2026), so
   * today every fetch resolves from `STATUTE_COUNTRIES_FALLBACK` — the same
   * seed v1 used, mirroring the production distribution. UNLIKE v1, the
   * fallback is not a silent swallow: the result carries `source`, so callers
   * can tell live counts from seeded ones and nothing has to be re-plumbed on
   * the day the endpoint ships — the queryFn already prefers it.
   *
   * No viewer partition: the facets are global counts.
   */
  countries: () =>
    queryOptions({
      queryKey: [...statutesQueries.all, 'countries'] as const,
      queryFn: async (): Promise<StatuteCountries> => {
        try {
          const res = await statutesApi.getCountryFacets();
          // SHAPE-CHECK a 200 before trusting it: these facets feed
          // `facets.countries.map(...)` in the tab row, so a well-formed
          // error page or a drifted payload answering 200 would crash the
          // whole list screen. A response without a countries ARRAY is not
          // facets — fall back to the seed exactly like a failed request.
          if (!Array.isArray(res.data?.countries)) {
            return { ...STATUTE_COUNTRIES_FALLBACK, source: 'seed' };
          }
          return { ...res.data, source: 'live' };
        } catch {
          return { ...STATUTE_COUNTRIES_FALLBACK, source: 'seed' };
        }
      },
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
    }),

  details: () => [...statutesQueries.all, 'detail'] as const,

  /** The reader's metadata payload — header, status, node counts. */
  detail: (slug: string) =>
    queryOptions({
      queryKey: [...statutesQueries.details(), slug] as const,
      queryFn: () => statutesApi.getBySlug(slug),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
    }),

  /**
   * The full AKN 3.0 XML — the reader's document source
   * (`GET /statutes/{slug}/export-akn`, uncapped; measured 275 KB / 719 nodes
   * for courts-act-1993). Kept OUTSIDE `details()` on purpose: a blanket
   * detail invalidation must not re-download a quarter-megabyte of XML to
   * refresh a bookmark count.
   *
   * STATIC tier, deliberately stronger than the rest of the feature: a
   * statute's text changes only when the law is re-imported, and a background
   * refocus refetch mid-read would re-download the XML, re-parse it (~100ms+
   * main-thread on the biggest Acts) and re-render every mounted block under
   * the reader. Never-stale-in-session is the honest policy for an immutable
   * document; the reference gcTime still bounds memory to the last few
   * documents read, and the error state's retry uses `refetch()`, which a
   * static staleTime does not block.
   */
  akn: (slug: string) =>
    queryOptions({
      queryKey: [...statutesQueries.all, 'akn', slug] as const,
      queryFn: () => statutesApi.exportAkn(slug),
      staleTime: STALE_TIMES.static,
      gcTime: GC_TIMES.reference,
    }),
};
