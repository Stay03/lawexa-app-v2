import type { Country } from '@/types/case';
import type { StatuteCountriesData } from '@/types/statute';

/**
 * reader-country — which country tab the statute library opens on, and the
 * facets behind the tabs. Pure, so the browser and the server prefetch read the
 * same rules and a test can pin them.
 *
 * THE TAB A READER OPENS ON (Stay, 3 October 2026, long-list #7): the reader's
 * own country, not Nigeria for everyone ("not all users are Nigerian although
 * above 80%"), and All when their country is unknown or has no statutes. The
 * country comes from the profile, else from the location the API derives from
 * the request; the profile is preferred because the server knows it too.
 *
 * THE ADDRESS: no `country` parameter means "the reader's own country", and the
 * All tab is written as `?country=all`, so choosing All survives a reload.
 */

export const ALL_COUNTRIES_PARAM = 'all';

/** A reader's country as the profile or the location gives it. */
export interface ReaderCountry {
  name?: string | null;
  /** ISO 3166-1 alpha-2 ("GH"), or the code the API uses. */
  code?: string | null;
}

/** A tab's country, with the alpha-2 the live endpoint adds ("GB" for "UK"). */
type FacetCountry = Country & { iso_alpha2?: string | null };

/**
 * The slug of the reader's country among the tabs, or null when it is unknown
 * or has no statutes. Matches the alpha-2 code first (the location gives "GB"
 * where the API's own code is "UK"), then the name.
 */
export function readerCountrySlug(
  facets: StatuteCountriesData | undefined,
  reader: ReaderCountry,
): string | null {
  if (!facets) return null;
  const code = reader.code?.trim().toUpperCase();
  const name = reader.name?.trim().toLowerCase();
  if (!code && !name) return null;
  const countries = facets.countries.map((facet) => facet.country as FacetCountry);
  const byCode = code
    ? countries.find((c) => c.iso_alpha2?.toUpperCase() === code || c.code?.toUpperCase() === code)
    : undefined;
  const byName = name ? countries.find((c) => c.name.toLowerCase() === name) : undefined;
  return (byCode ?? byName)?.slug ?? null;
}

/** The tab a URL's `country` parameter selects: a slug, or '' for All. */
export function countryTabFromParam(
  param: string | null | undefined,
  readerSlug: string | null,
): string {
  const value = param?.trim() ?? '';
  if (value === ALL_COUNTRIES_PARAM) return '';
  if (value) return value;
  return readerSlug ?? '';
}

/** The `country` parameter to write for a tab: none for the reader's own. */
export function countryParamForTab(slug: string, readerSlug: string | null): string | null {
  if (slug && slug === readerSlug) return null;
  return slug || ALL_COUNTRIES_PARAM;
}

/**
 * The tab facets from `GET /statutes/countries`, in either shape: the
 * documented `{ total, countries: [{ country, statute_count }] }`, or the flat
 * list the live endpoint returns (3 October 2026: `[{ id, name, slug, code,
 * iso_alpha2, statutes_count }]`). With the flat list, All shows `meta.total`
 * (every statute, with a country or without; asked of backend in 47e501aa)
 * when the response carries it, else the sum of the countries' counts. Null
 * for anything else, so the caller keeps its seed.
 */
export function normaliseCountryFacets(
  data: unknown,
  metaTotal?: number | null,
): StatuteCountriesData | null {
  if (Array.isArray(data)) {
    const countries = data
      .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
      .filter((row) => typeof row.slug === 'string' && typeof row.name === 'string' && typeof row.id === 'number')
      .map((row) => ({
        country: {
          id: row.id as number,
          name: row.name as string,
          slug: row.slug as string,
          code: typeof row.code === 'string' ? row.code : '',
          abbreviation: typeof row.abbreviation === 'string' ? row.abbreviation : '',
          iso_alpha2: typeof row.iso_alpha2 === 'string' ? row.iso_alpha2 : null,
        } as FacetCountry,
        statute_count: typeof row.statutes_count === 'number' ? row.statutes_count : 0,
      }));
    if (countries.length === 0) return null;
    const sum = countries.reduce((total, facet) => total + facet.statute_count, 0);
    return { total: typeof metaTotal === 'number' && metaTotal >= sum ? metaTotal : sum, countries };
  }
  if (data && typeof data === 'object' && Array.isArray((data as StatuteCountriesData).countries)) {
    return data as StatuteCountriesData;
  }
  return null;
}
