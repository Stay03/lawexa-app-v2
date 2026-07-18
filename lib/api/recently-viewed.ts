import { apiClient } from './client';
import type {
  RecentlyViewedListResponse,
  RecentlyViewedParams,
} from '@/types/recently-viewed';

/**
 * Recently-viewed API service (backend Ask A). ONE merged, interleaved feed of
 * the cases, notes, and statutes the caller has opened — newest first, each item
 * once. Mirrors the `casesApi` exemplar: a thin wrapper returning the raw
 * paginated envelope unchanged; the v2 query factory owns the policy.
 */
export const recentlyViewedApi = {
  getList: async (
    params: RecentlyViewedParams = {}
  ): Promise<RecentlyViewedListResponse> => {
    const response = await apiClient.get<RecentlyViewedListResponse>(
      '/users/recently-viewed',
      {
        params: {
          // Axios serializes an array as `types[]=case&types[]=note` — the exact
          // shape the endpoint expects; omitted entirely when unset ⇒ all types.
          types: params.types?.length ? params.types : undefined,
          per_page: params.per_page ?? 10,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },
};
