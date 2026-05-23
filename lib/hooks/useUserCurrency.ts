'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { geoApi } from '@/lib/api/geo';
import { useUserCurrencyStore } from '@/lib/stores/userCurrencyStore';
import type { TCurrency } from '@/types/payment';

/******************************************************************************
                               Constants
******************************************************************************/

/**
 * Currency used while geo detection is in-flight or unreachable. Backend
 * guarantees a 200 response for every case (private IPs, GeoIP misses, provider
 * outages all degrade to `suggested_currency: 'USD'`), so in practice this only
 * applies during the brief in-flight window. USD is also the safer default for
 * the international audience the picker exists to serve.
 */
const FALLBACK_CURRENCY: TCurrency = 'USD';

export const geoCurrencyKeys = {
  all: ['geoCurrency'] as const,
  country: () => [...geoCurrencyKeys.all, 'country'] as const,
};

/******************************************************************************
                               Hook
******************************************************************************/

/**
 * Currency for a payment surface. Returns the user's stored preference if any,
 * otherwise the geo-detected suggestion, otherwise FALLBACK_CURRENCY. Triggers
 * geo detection on first mount when no stored preference exists; subsequent
 * visits skip the call entirely.
 */
export function useUserCurrency(): {
  currency: TCurrency;
  manualOverride: boolean;
  isDetecting: boolean;
} {
  const stored = useUserCurrencyStore((s) => s.currency);
  const manualOverride = useUserCurrencyStore((s) => s.manualOverride);
  const setDetected = useUserCurrencyStore((s) => s.setDetected);

  // Only fetch geo if we don't already have a stored preference.
  const shouldDetect = stored === null;

  const geoQuery = useQuery({
    queryKey: geoCurrencyKeys.country(),
    queryFn: () => geoApi.getCountry(),
    enabled: shouldDetect,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  // Apply the geo result to the store exactly once per resolution.
  useEffect(() => {
    if (!shouldDetect) return;
    const suggested = geoQuery.data?.data?.suggested_currency;
    if (suggested) {
      setDetected(suggested);
    }
  }, [shouldDetect, geoQuery.data, setDetected]);

  return {
    currency: stored ?? FALLBACK_CURRENCY,
    manualOverride,
    isDetecting: shouldDetect && geoQuery.isLoading,
  };
}
