import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';

import { geoApi } from '@/lib/api/geo';
import type { TCurrency } from '@/types/payment';

/**
 * THE CURRENCY A PERSON PAYS IN — v2's reading of the same choice v1 keeps.
 *
 * v1 stores it with zustand's `persist` under `lawexa-user-currency`, as
 * `{"state":{"currency":"NGN","manualOverride":false},"version":0}`. v2 may not
 * import v1's stores (the `import/no-restricted-paths` rule), so this module
 * reads and writes the SAME key in the SAME shape. A choice made in either app
 * is the choice in both.
 *
 * The rules are v1's (`lib/hooks/useUserCurrency.ts`, `lib/stores/userCurrencyStore.ts`):
 *  - a stored currency wins;
 *  - with none stored, `GET /geo/country` suggests one, which is stored as
 *    detected (not a manual choice);
 *  - a detected value never replaces a manual one;
 *  - until anything is known, USD.
 *
 * Shape as in `v2/search-position.ts`: a module-level external store read
 * through `useSyncExternalStore`, a server snapshot that is the fallback so SSR
 * and the first client render agree, and a `storage` listener for other tabs.
 */

const STORAGE_KEY = 'lawexa-user-currency';
const FALLBACK: TCurrency = 'USD';

interface Stored {
  currency: TCurrency | null;
  manualOverride: boolean;
}

const EMPTY: Stored = { currency: null, manualOverride: false };
let current: Stored | null = null;
const listeners = new Set<() => void>();

function isCurrency(value: unknown): value is TCurrency {
  return value === 'NGN' || value === 'USD';
}

function read(): Stored {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const state = raw ? (JSON.parse(raw) as { state?: Partial<Stored> }).state : null;
    return {
      currency: isCurrency(state?.currency) ? state.currency : null,
      manualOverride: state?.manualOverride === true,
    };
  } catch {
    return EMPTY;
  }
}

function write(next: Stored): void {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: next, version: 0 }));
  } catch {
    // Storage disabled: the choice still holds for this page's life.
  }
  for (const listener of listeners) listener();
}

function getSnapshot(): Stored {
  if (current === null) current = read();
  return current;
}

function getServerSnapshot(): Stored {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    current = read();
    onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** A deliberate choice (the currency switch in a Buy panel). */
export function setCurrency(currency: TCurrency): void {
  write({ currency, manualOverride: true });
}

export function useCurrency(): { currency: TCurrency; isDetecting: boolean } {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const needsDetection = stored.currency === null;

  // Detection writes the store from the query itself, so no effect sets state
  // after render (React Compiler lint), and it runs once per browser.
  const detection = useQuery({
    queryKey: ['v2', 'currency', 'geo'] as const,
    queryFn: async () => {
      const suggested = (await geoApi.getCountry()).data?.suggested_currency;
      const now = getSnapshot();
      if (isCurrency(suggested) && !now.manualOverride && now.currency === null) {
        write({ currency: suggested, manualOverride: false });
      }
      return suggested ?? null;
    },
    enabled: needsDetection,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  return {
    currency: stored.currency ?? FALLBACK,
    isDetecting: needsDetection && detection.isLoading,
  };
}
