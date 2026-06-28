import type { Country } from '@/types/case';
import type { StatuteCountriesData } from '@/types/statute';

/**
 * Temporary fallback for the statute country tabs.
 *
 * Mirrors the current production distribution of statutes per country so the
 * country tabs render before the backend facets endpoint
 * (`GET /api/statutes/countries`, see docs/backend-statute-country-facets.md)
 * is live. Once that endpoint ships, `useStatuteCountries` consumes it
 * automatically and this constant can be deleted.
 *
 * `total` includes the single country-less statute (country_id = NULL), which
 * has no tab of its own and only appears under "All": 787 + 150 + 52 + 15 + 1.
 */
const country = (id: number, name: string, slug: string, code: string): Country => ({
  id,
  name,
  slug,
  code,
  abbreviation: code,
});

export const STATUTE_COUNTRIES_FALLBACK: StatuteCountriesData = {
  total: 1005,
  countries: [
    { country: country(1, 'Nigeria', 'nigeria', 'NG'), statute_count: 787 },
    { country: country(2, 'Ghana', 'ghana', 'GH'), statute_count: 150 },
    { country: country(22, 'Tanzania', 'tanzania', 'TZ'), statute_count: 52 },
    { country: country(23, 'Uganda', 'uganda', 'UG'), statute_count: 15 },
  ],
};
