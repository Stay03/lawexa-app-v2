'use client';

import { useQuery } from '@tanstack/react-query';

import { authApi } from '@/lib/api/auth';
import { useV2Session } from '@/v2/runtime/session-context';
import type { ReaderCountry } from './reader-country';

/** What `/auth/me` adds beside the user: the location the API derives from the
 *  request (`{ country: "Ghana", country_code: "GH", … }`). */
interface MeLocation {
  location?: { country?: string | null; country_code?: string | null } | null;
}

/**
 * The reader's country for the statute library's opening tab: the profile's,
 * else the location the API reads from the request.
 *
 * `settled` is false only while the location is still being read for a reader
 * with no profile country, so the library can hold its list rather than open on
 * All and jump to the reader's country a moment later. The location is read
 * once per session (it does not change while the app is open).
 */
export function useReaderCountry(): { country: ReaderCountry; settled: boolean } {
  const { signedIn, profileCountryName, profileCountryCode } = useV2Session();
  const hasProfileCountry = !!(profileCountryName || profileCountryCode);

  const location = useQuery({
    queryKey: ['v2', 'me', 'location'] as const,
    queryFn: async () => {
      const response = await authApi.meSilent();
      const data = response.data as (typeof response.data & MeLocation) | undefined;
      return data?.location ?? null;
    },
    enabled: signedIn && !hasProfileCountry,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  if (hasProfileCountry) {
    return { country: { name: profileCountryName, code: profileCountryCode }, settled: true };
  }
  if (!signedIn) return { country: {}, settled: true };
  return {
    country: { name: location.data?.country ?? null, code: location.data?.country_code ?? null },
    settled: !location.isPending,
  };
}
