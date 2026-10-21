import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { StatuteCountries } from '../queries';
import { facetsForSearch } from './search-facets';

/* Tester, 20 October 2026 (findings 12 and 28): the country tabs counted the
 * whole library while the list showed a search. Backend 6d218a29 counts a
 * search's matches per country. */

const country = (slug: string, id: number) => ({ id, name: slug, slug, code: '', abbreviation: '', iso_alpha2: null });
const library: StatuteCountries = {
  total: 900,
  countries: [
    { country: country('nigeria', 1), statute_count: 700 },
    { country: country('ghana', 2), statute_count: 200 },
  ],
  source: 'live',
};
const search: StatuteCountries = { total: 12, countries: [{ country: country('nigeria', 1), statute_count: 12 }], source: 'live' };

test('with no search the tabs show the library', () => {
  assert.equal(facetsForSearch(library, search, false), library);
});

test("during a search each tab counts its matches, a country without any reads 0, and its tab stays", () => {
  const tabs = facetsForSearch(library, search, true);
  assert.equal(tabs.total, 12);
  assert.deepEqual(tabs.countries.map((facet) => [facet.country.slug, facet.statute_count]), [['nigeria', 12], ['ghana', 0]]);
  assert.equal(tabs.source, 'live');
});

test('a search with no matches reads 0 everywhere', () => {
  const none = facetsForSearch(library, { total: 0, countries: [], source: 'live' }, true);
  assert.equal(none.total, 0);
  assert.deepEqual(none.countries.map((facet) => facet.statute_count), [0, 0]);
});

test("while the search's counts load, or if they failed, the tabs show no numbers", () => {
  assert.equal(facetsForSearch(library, undefined, true).source, 'seed');
  assert.equal(facetsForSearch(library, { ...search, source: 'seed' }, true).source, 'seed');
});

test('the list asks for the counts of the search it shows, and only the tabs read them', () => {
  const browser = readFileSync(join(process.cwd(), 'v2', 'features', 'statutes', 'list', 'StatutesBrowser.tsx'), 'utf8');
  assert.match(browser, /\.\.\.statutesQueries\.countriesForSearch\(activeSearch\),\s*enabled: signedIn && activeSearch !== '',/);
  assert.match(browser, /<CountryTabs\s*facets=\{tabFacets\}/);
  assert.match(browser, /resolveCountryId\(facets, countrySlug\)/);
  const queries = readFileSync(join(process.cwd(), 'v2', 'features', 'statutes', 'queries.ts'), 'utf8');
  const leaf = queries.slice(queries.indexOf('countriesForSearch:'));
  assert.doesNotMatch(leaf.slice(0, leaf.indexOf('}),')), /persist/);
});
