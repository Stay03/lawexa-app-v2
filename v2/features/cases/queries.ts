import { queryOptions } from '@tanstack/react-query';
import { casesApi } from '@/lib/api/cases';
import type { CaseListParams } from '@/types/case';
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
 */
export const casesQueries = {
  all: ['cases'] as const,

  lists: () => [...casesQueries.all, 'list'] as const,

  /**
   * Paginated case list. Reference tier — cases change rarely, and the 10-min
   * staleTime / 30-min gcTime also preserves list scroll position on back-nav.
   */
  list: (params: CaseListParams = {}) =>
    queryOptions({
      queryKey: [...casesQueries.lists(), params] as const,
      queryFn: () => casesApi.getList(params),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
    }),

  details: () => [...casesQueries.all, 'detail'] as const,

  /** A single case by slug. Reference tier — same rationale as the list. */
  detail: (slug: string) =>
    queryOptions({
      queryKey: [...casesQueries.details(), slug] as const,
      queryFn: () => casesApi.getBySlug(slug),
      staleTime: STALE_TIMES.reference,
      gcTime: GC_TIMES.reference,
    }),
};
