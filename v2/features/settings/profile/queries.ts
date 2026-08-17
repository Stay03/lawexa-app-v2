import { queryOptions } from '@tanstack/react-query';

import { authApi } from '@/lib/api/auth';
import { expertiseApi } from '@/lib/api/expertise';
import { universityApi } from '@/lib/api/universities';
import { STALE_TIMES } from '@/v2/runtime/query';

/** One country, as the two rows of this form need it. */
export interface ProfileCountry {
  name: string;
  /** ISO 3166-1 alpha-2. Not stored on the profile, kept for a future flag. */
  code: string;
}

/**
 * The list of countries, from the same public service v1 reads.
 *
 * ── WHY THE FETCHER IS RESTATED HERE ───────────────────────────────────────
 * v1 keeps it inside `lib/hooks/useCountries.ts`, which is a HOOK, and v2 is
 * barred from importing v1 hooks (the `import/no-restricted-paths` rule) for
 * the reason this whole tree exists: a v1 hook drags v1's own query policy,
 * its own key, and whatever else it grows into the v2 bundle. What is copied
 * is nine lines of `fetch` and a sort, and the SHAPE is kept identical, above
 * all that the stored value is the country's common NAME. That matters twice
 * over: it is what the backend already holds for every existing account, and
 * `getLevelOptions` keys its study-level names off exactly those strings.
 *
 * NOT `lib/api/jurisdictions.ts`, which is a different list for a different
 * question: the jurisdictions Lawexa carries law for, not the countries a
 * person can live in.
 */
async function fetchCountries(): Promise<ProfileCountry[]> {
  const response = await fetch(
    'https://restcountries.com/v3.1/all?fields=name,cca2',
  );
  if (!response.ok) throw new Error('The country list could not be loaded.');
  const payload = (await response.json()) as {
    name: { common: string };
    cca2: string;
  }[];
  return payload
    .map((country) => ({ name: country.name.common, code: country.cca2 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The profile screen's read.
 *
 * ── WHY `/auth/me` AND NOT `/profile` ──────────────────────────────────────
 * `lib/api/profile.ts` also exposes `getProfile()` against `GET /profile`, and
 * nothing in this codebase has ever called it (measured, 16 August 2026: the
 * only reference is its own declaration). `authApi.me()` is what v1's profile
 * page reads through `useAuth`, so it is the shape this form was written
 * against and the one the backend serves every day. An unexercised endpoint is
 * not a better source just because its name matches the screen.
 *
 * ── NO `REFETCH_ON_VISIT` HERE, DELIBERATELY ───────────────────────────────
 * That flag is for surfaces that can ADD what arrives without discarding what
 * is on screen. A form cannot: the person may be halfway through typing, and
 * a background answer landing in the middle of that must never rewrite the
 * fields. So the form seeds itself ONCE from whatever this resolves, and the
 * standard tier decides when the underlying record is re-read. A save re-seeds
 * the form from the server's own response, which is the only moment the two
 * are meant to agree again.
 */
export const profileQueries = {
  all: ['profile'] as const,

  /** The signed-in account, with its profile and its areas of expertise. */
  me: () =>
    queryOptions({
      queryKey: [...profileQueries.all, 'me'] as const,
      queryFn: () => authApi.me(),
      staleTime: STALE_TIMES.standard,
    }),

  /** Every country, for the country picker. STATIC tier: the runtime doc names
   *  this exact case ("boot constants: plans, countries, flags"), and the set of
   *  countries does not change while a tab is open. */
  countries: () =>
    queryOptions({
      queryKey: [...profileQueries.all, 'countries'] as const,
      queryFn: fetchCountries,
      staleTime: STALE_TIMES.static,
    }),

  /** Every area of expertise, for the multi-select. Same tier and the same
   *  argument; v1's own hook already treated it as good for ten minutes. */
  expertise: () =>
    queryOptions({
      queryKey: [...profileQueries.all, 'expertise'] as const,
      queryFn: () => expertiseApi.getAll({ per_page: 100 }),
      staleTime: STALE_TIMES.static,
    }),
};

/**
 * The universities we know about, for the picker on this screen.
 *
 * ── WHY THESE ARE RESTATED HERE ────────────────────────────────────────────
 * v1 already has `useUniversities.ts`, and v2 is barred from importing v1 HOOKS
 * (`import/no-restricted-paths`) for the same reason `profileQueries.countries`
 * restates its fetcher: a v1 hook drags v1's query policy and key into the v2
 * bundle. The API module underneath is shared and imported directly, so only
 * the query options are written again — no second copy of the request.
 *
 * ── TWO LISTS, BECAUSE ONE WOULD BE WRONG FOR SOMEBODY ─────────────────────
 * Nothing typed shows the institutions in the reader's own country, which is
 * almost always the answer and is one short list. Two characters or more asks
 * every country, because a student studying abroad is not an edge case worth
 * stranding.
 *
 * Both are `reference`: a list of universities does not change while somebody
 * is looking at it, and the pair is opened and closed repeatedly while a person
 * makes up their mind.
 */
export const universityQueries = {
  byCountry: (countryCode: string | undefined) =>
    queryOptions({
      queryKey: ['v2', 'universities', 'country', countryCode ?? null],
      queryFn: () =>
        universityApi.getAll({
          country_code: countryCode,
          per_page: 100,
          sort: 'name',
          order: 'asc',
        }),
      enabled: Boolean(countryCode),
      staleTime: STALE_TIMES.reference,
    }),

  /** Below two characters this never runs: the server's own threshold, and the
   *  country list stays on screen rather than emptying itself for one letter. */
  search: (term: string) =>
    queryOptions({
      queryKey: ['v2', 'universities', 'search', term],
      queryFn: () => universityApi.search(term),
      enabled: term.trim().length >= 2,
      staleTime: STALE_TIMES.reference,
    }),
};
