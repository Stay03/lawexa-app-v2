import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';

/******************************************************************************
                               Types
******************************************************************************/

/**
 * A country somebody can say they live in, as this app needs it: a display
 * name and an ISO 3166-1 alpha-2 code.
 */
export interface Country {
  name: string;
  /** ISO 3166-1 alpha-2, e.g. "NG", "GB", "DE". */
  code: string;
}

/** The shape `GET /countries/iso` returns. */
interface CountryIsoRow {
  name: string;
  iso_alpha2: string;
  slug: string;
}

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Every country, from our own API.
 *
 * ── WHY THIS MODULE EXISTS ────────────────────────────────────────────────
 * Until 21 September 2026 both v1 (`lib/hooks/useCountries.ts`) and v2
 * (`v2/features/settings/profile/queries.ts`) each kept their own copy of a
 * `fetch` to `restcountries.com/v3.1`. That provider retired the version we
 * called and now answers **HTTP 200 with a deprecation body**, so the
 * `if (!response.ok) throw` in both copies never fired and `.map` ran over an
 * object. Every country list in the app went empty, in silence: the profile
 * screen, v1 settings, onboarding and five admin screens.
 *
 * One module rather than two copies, because two copies is how one of them
 * gets fixed and the other does not.
 *
 * ── WHY `/countries/iso` AND NOT `/countries` OR `/countries/jurisdictions` ─
 * Measured against production on 2026-09-21, both of the obvious endpoints are
 * wrong for a "where do you live" field:
 *
 *   /countries               205 rows, but exposes `code`, which is a legacy
 *                            column holding non-ISO values for ten rows — UK,
 *                            GER, SAF, TRI and others. The universities API is
 *                            keyed on ISO, so `GER` returns 0 universities
 *                            where `DE` returns 283. A present-but-wrong code
 *                            looks exactly like a country with none.
 *   /countries/jurisdictions 201 rows, filtered on `is_jurisdiction`, which
 *                            answers "whose law is this". It drops the UNITED
 *                            KINGDOM as a legacy duplicate and keeps England &
 *                            Wales, Scotland and Northern Ireland. Correct for
 *                            a case, wrong for an address.
 *
 * `/countries/iso` is scoped on `whereNotNull('iso_alpha2')` and returns the
 * canonical code, so the UK is present and the regional aggregates are not.
 *
 * Requires auth. Every surface that shows a country list is behind a login, so
 * that costs nothing.
 */
async function getAll(): Promise<Country[]> {
  const response =
    await apiClient.get<ApiResponse<CountryIsoRow[]>>('/countries/iso');

  return (response.data.data ?? [])
    .map((country) => ({ name: country.name, code: country.iso_alpha2 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/******************************************************************************
                               Export default
******************************************************************************/

export const countriesApi = {
  getAll,
} as const;
