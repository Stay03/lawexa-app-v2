import { queryOptions } from '@tanstack/react-query';
import { jurisdictionsApi } from '@/lib/api/jurisdictions';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Jurisdictions query policy — copies the `v2/features/cases/queries.ts`
 * exemplar exactly: a hierarchical key factory whose leaf is a `queryOptions()`
 * object, wrapping the shared `lib/api/jurisdictions.ts` fetcher unchanged (the
 * same data layer v1 uses). Only this query-policy wrapper is new.
 *
 * STATIC tier ('static' → never refetched in a session). The jurisdiction list
 * is a boot constant — the runtime doc names exactly this case ("boot constants:
 * plans, countries, flags") as the static tier, and v1's own hook treated it as
 * good-for-a-day (24h staleTime / 7d gcTime). The set of legal jurisdictions
 * does not change while a tab is open, so refetching it on refocus would be pure
 * waste; the picker reads one cached copy for the whole session.
 *
 * `enabled` is intentionally NOT baked into the leaf — it's a call-site concern
 * (`useQuery({ ...jurisdictionsQueries.list(), enabled: signedIn })`), the same
 * policy the exemplar documents (the endpoint requires a Bearer token, so it is
 * gated to signed-in surfaces at the call site).
 */
export const jurisdictionsQueries = {
  all: ['jurisdictions'] as const,

  /** The full jurisdiction list (name, ISO code, parent) for the picker. */
  list: () =>
    queryOptions({
      queryKey: [...jurisdictionsQueries.all, 'list'] as const,
      queryFn: () => jurisdictionsApi.list(),
      staleTime: STALE_TIMES.static,
    }),
};
