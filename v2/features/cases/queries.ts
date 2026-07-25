import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { casesApi } from '@/lib/api/cases';
import { chatApi } from '@/lib/api/chat';
import { trendingApi } from '@/lib/api/trending';
import type { CaseListParams } from '@/types/case';
import type { TrendingParams } from '@/types/trending';
import { GC_TIMES, STALE_TIMES } from '@/v2/runtime/query';

/**
 * EXEMPLAR — the pattern every v2 feature copies (standards §2).
 *
 * A hierarchical query-key factory whose LEAVES are `queryOptions()` objects.
 * One typed definition per query, shared verbatim by `useQuery`,
 * `useSuspenseQuery`, `prefetchQuery`, `getQueryData`, etc. — so a component, an
 * RSC prefetch, and a cache read can never drift on key or fetcher. No inline
 * keys anywhere; no bespoke `useCases`-style hooks (a hook, if one is even
 * needed, is a thin wrapper over these).
 *
 * Structure convention (mirror it in every feature):
 *  - `all`        the feature's root key segment (a value, not a function).
 *  - `lists()`    the "all lists" key — the invalidation handle for every list
 *                 variant (`queryClient.invalidateQueries({ queryKey: casesQueries.lists() })`).
 *  - `list(p)`    a concrete list query (leaf → `queryOptions`).
 *  - `details()`  the "all details" key — invalidation handle for every detail.
 *  - `detail(id)` a concrete detail query (leaf → `queryOptions`).
 *
 * Wraps the existing `lib/api/cases.ts` fetchers unchanged — the data layer
 * (api + types) is reused across v1/v2; only this query-policy wrapper is new.
 *
 * `enabled` is deliberately NOT baked into the leaves: it's a call-site concern
 * (`useQuery({ ...casesQueries.detail(slug), enabled: !!slug })`) and would make
 * the same object illegal for `useSuspenseQuery`, which these leaves must also
 * serve.
 *
 * ── THREE DETAIL SHAPES, AND WHY THEY ARE SEPARATE ──────────────────────────
 * `GET /cases/{slug}` returns a different payload per `include_*` combination,
 * so the shape is part of the identity of the request and each shape is its own
 * cache entry. v2 asks for exactly three, one per reading surface:
 *
 *   `preview(slug)`  no includes  — the chat hover-card. Deliberately the lean
 *                    payload: a transcript can mention a dozen cases and a
 *                    hover must not pull a dozen judgments' worth of related
 *                    citations.
 *   `detail(slug)`   similar + cited + cited_by — the case page.
 *   `report(slug)`   full_report only — the full-judgment page. v1 also asked
 *                    for the related sets here and then rendered none of them;
 *                    dropped.
 *
 * THE COST OF THAT SPLIT IS A BACKEND QUESTION, NOT A FRONTEND ONE. Every one
 * of those requests is a separate `GET /cases/{slug}`, and that endpoint appears
 * to record a view and to count against the plan's monthly view limit — so
 * hovering a case mention, opening the case, then opening its report may spend
 * three views on one reading. We cannot tell from here, and we will not guess by
 * withholding a request the reader needs. It is raised in
 * `docs/v2-docs/backend-ask-2026-07-25-cases-read-endpoints.md`; if views are
 * per-request, `preview` is the one to move behind a cheaper endpoint.
 *
 * ── NO `REFETCH_ON_VISIT` ON THESE LISTS (unlike conversations) ─────────────
 * That flag exists so a list can answer "what is new since I was last here?" for
 * data the USER or their teammates change from another tab or device. Nobody
 * publishes a case from another tab: the library changes when our editors add to
 * it, on a cadence of days. So the `reference` tier (10 minutes) is the honest
 * lever here, and a per-navigation refetch of every loaded infinite page would
 * be pure cost with nothing to announce. The one thing a user CAN change from
 * here — a bookmark — is written straight into this cache by the bookmark
 * mutation, so it never waits on a refetch either.
 */

/** The list page's page size — shared by the client query and the RSC prefetch,
 *  so the server-hydrated entry and the client's first request are one key. */
export const CASES_PAGE_SIZE = 15;

/**
 * The list's viewer partition. `is_bookmarked` is per-user, so a cached page of
 * cases belongs to the account that fetched it — the same rule (and the same
 * reasoning) as `conversationsQueries`. Required, not optional: forgetting it is
 * then a type error rather than a silent cross-account leak.
 */
export interface ViewerScoped {
  viewerId: number | null;
}

export const casesQueries = {
  all: ['cases'] as const,

  lists: () => [...casesQueries.all, 'list'] as const,

  /**
   * Paginated case list. Reference tier — cases change rarely, and the 10-min
   * staleTime / 30-min gcTime also preserves list scroll position on back-nav.
   */
  list: ({ viewerId, ...params }: CaseListParams & ViewerScoped) =>
    queryOptions({
      queryKey: [...casesQueries.lists(), params, { viewerId }] as const,
      queryFn: () => casesApi.getList(params),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
    }),

  /**
   * The `/cases` browse list. A SEPARATE key from `list()` — TanStack forbids
   * sharing a key between `useQuery` and `useInfiniteQuery` (standards §2), and
   * the shapes genuinely differ (`{ pages }` vs one envelope).
   */
  infiniteList: ({
    viewerId,
    ...params
  }: Omit<CaseListParams, 'page'> & ViewerScoped) =>
    infiniteQueryOptions({
      queryKey: [
        ...casesQueries.lists(),
        'infinite',
        params,
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        casesApi.getList({ ...params, per_page: CASES_PAGE_SIZE, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.list,
    }),

  /**
   * The Trending view of the same surface. Its own feature endpoint
   * (`/trending/cases`) with its own row shape, keyed under `lists()` so a
   * bookmark write and a blanket list invalidation reach it too.
   */
  infiniteTrending: ({
    viewerId,
    ...params
  }: Omit<TrendingParams, 'page'> & ViewerScoped) =>
    infiniteQueryOptions({
      queryKey: [
        ...casesQueries.lists(),
        'trending',
        params,
        { viewerId },
      ] as const,
      queryFn: ({ pageParam }) =>
        trendingApi.getCases({ ...params, per_page: CASES_PAGE_SIZE, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => {
        const { current_page, last_page } = lastPage.pagination;
        return current_page < last_page ? current_page + 1 : undefined;
      },
      // Trending is a ranking over recent views, so it moves faster than the
      // library itself — but not per-minute. `standard` keeps it honest across a
      // session without re-ranking under the reader.
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
    }),

  details: () => [...casesQueries.all, 'detail'] as const,

  /**
   * The LEAN case payload — no related sets. Used by the chat hover-card only
   * (`CasePreview`). Reference tier: a second open is instant from cache.
   */
  preview: (slug: string) =>
    queryOptions({
      queryKey: [...casesQueries.details(), slug, 'preview'] as const,
      queryFn: () => casesApi.getBySlug(slug),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
    }),

  /**
   * The CASE PAGE payload — the case plus its three citation sets.
   *
   * `searchQuery` is analytics only: v1 forwards the list's search terms as `?q=`
   * so the backend can attribute a read to the search that produced it. It is
   * part of the key because it is part of the request, but a case opened from a
   * different search is the same case — so the row that matters (the case) is
   * identical in both entries and the duplication is bounded by how many
   * distinct searches led here in one session.
   */
  detail: (slug: string, searchQuery?: string) =>
    queryOptions({
      queryKey: [
        ...casesQueries.details(),
        slug,
        'full',
        { q: searchQuery ?? null },
      ] as const,
      queryFn: () =>
        casesApi.getBySlug(slug, {
          includeSimilarCases: true,
          includeCitedCases: true,
          includeCitedBy: true,
          searchQuery,
        }),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
    }),

  /** The FULL-JUDGMENT payload — the case plus `full_report`, nothing else. */
  report: (slug: string) =>
    queryOptions({
      queryKey: [...casesQueries.details(), slug, 'report'] as const,
      queryFn: () => casesApi.getBySlug(slug, { includeFullReport: true }),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
    }),

  /**
   * The reader's OWN conversations about this case (`GET /cases/{slug}/conversations`,
   * owner-scoped). Powers the case page's "Your chats about this case" section, so
   * asking a follow-up a week later means resuming a thread rather than starting a
   * fresh one.
   *
   * `standard` tier and NOT keyed under `lists()`: this is conversation data that
   * happens to be indexed by a case, and a case-list invalidation has no business
   * dropping it. Asking a new question about the case invalidates it explicitly.
   */
  conversations: (slug: string, { viewerId }: ViewerScoped) =>
    queryOptions({
      queryKey: [...casesQueries.all, 'conversations', slug, { viewerId }] as const,
      queryFn: () =>
        chatApi.listContentConversations('case', slug, { per_page: 5 }),
      staleTime: STALE_TIMES.standard,
      gcTime: GC_TIMES.list,
    }),
};
