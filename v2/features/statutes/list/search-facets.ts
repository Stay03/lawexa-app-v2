import type { StatuteCountries } from '../queries';

/**
 * The country tabs' counts while a search is on screen (Tester, 20 October
 * 2026, findings 12 and 28: the tabs counted the whole library while the list
 * showed a search). The tabs stay the library's own, so the reader's country
 * tab never vanishes under them mid-search; each count is that country's
 * matches, 0 where it has none, and All is every match. While the search's
 * counts are loading, or if they failed, the tabs show no numbers rather than
 * the library's, which would be wrong for the search.
 */
export function facetsForSearch(
  library: StatuteCountries,
  search: StatuteCountries | undefined,
  searching: boolean,
): StatuteCountries {
  if (!searching) return library;
  if (!search || search.source !== 'live' || library.source !== 'live') {
    return { ...library, source: 'seed' };
  }
  const counts = new Map(search.countries.map((facet) => [facet.country.slug, facet.statute_count]));
  return {
    ...library,
    total: search.total,
    countries: library.countries.map((facet) => ({
      ...facet,
      statute_count: counts.get(facet.country.slug) ?? 0,
    })),
    source: 'live',
  };
}
