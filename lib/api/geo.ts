import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { IGeoCountryData } from '@/types/payment';

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Resolve the request IP to a country and a suggested default currency.
 *
 * Public endpoint (no auth required). Backend ignores any bearer token sent
 * with the request, so going through the authenticated apiClient is harmless
 * and keeps baseURL/JSON-header handling consistent with the rest of the API
 * layer. Backend guarantees a 200 response for every case (private IPs,
 * GeoIP misses, provider outages all degrade to `suggested_currency: 'USD'`).
 *
 * Backend-side cache is 3 days; React Query's `staleTime: Infinity` + the
 * persisted store on top mean we hit this at most once per browser install.
 */
async function getCountry(): Promise<ApiResponse<IGeoCountryData>> {
  const response = await apiClient.get<ApiResponse<IGeoCountryData>>('/geo/country');
  return response.data;
}

/******************************************************************************
                               Export default
******************************************************************************/

export const geoApi = {
  getCountry,
} as const;
