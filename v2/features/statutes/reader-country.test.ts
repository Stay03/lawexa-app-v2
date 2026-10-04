import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countryParamForTab,
  countryTabFromParam,
  normaliseCountryFacets,
  readerCountrySlug,
} from './reader-country';

/* #7 (Stay, 3 October 2026): the library opens on the reader's own country. */
const live = [
  { id: 1, name: 'Nigeria', slug: 'nigeria', code: 'NG', iso_alpha2: 'NG', statutes_count: 796 },
  { id: 2, name: 'Ghana', slug: 'ghana', code: 'GH', iso_alpha2: 'GH', statutes_count: 150 },
  { id: 4, name: 'United Kingdom', slug: 'united-kingdom', code: 'UK', iso_alpha2: 'GB', statutes_count: 1 },
];
const facets = normaliseCountryFacets(live)!;

test('the live flat list becomes tab facets, All summing the counts', () => {
  assert.equal(facets.countries.length, 3);
  assert.equal(facets.total, 947);
  assert.equal(facets.countries[1].country.slug, 'ghana');
  assert.equal(facets.countries[1].statute_count, 150);
});

test("the flat list's All uses meta.total when sent, never below the sum", () => {
  assert.equal(normaliseCountryFacets(live, 1023)!.total, 1023);
  assert.equal(normaliseCountryFacets(live, 5)!.total, 947);
});

test('the documented shape passes through, and anything else is refused', () => {
  const documented = { total: 5, countries: [{ country: { id: 1, name: 'Nigeria', slug: 'nigeria', code: 'NG', abbreviation: '' }, statute_count: 5 }] };
  assert.equal(normaliseCountryFacets(documented), documented);
  assert.equal(normaliseCountryFacets({ countries: 'x' }), null);
  assert.equal(normaliseCountryFacets([]), null);
});

test("a reader's country matches by alpha-2 first, then by name", () => {
  assert.equal(readerCountrySlug(facets, { code: 'GH' }), 'ghana');
  assert.equal(readerCountrySlug(facets, { code: 'GB' }), 'united-kingdom');
  assert.equal(readerCountrySlug(facets, { name: 'nigeria' }), 'nigeria');
  assert.equal(readerCountrySlug(facets, { code: 'KE', name: 'Kenya' }), null);
  assert.equal(readerCountrySlug(facets, {}), null);
});

test("no parameter opens the reader's country, or All when unknown; 'all' is All", () => {
  assert.equal(countryTabFromParam(null, 'ghana'), 'ghana');
  assert.equal(countryTabFromParam(null, null), '');
  assert.equal(countryTabFromParam('all', 'ghana'), '');
  assert.equal(countryTabFromParam('tanzania', 'ghana'), 'tanzania');
});

test("the reader's own tab writes no parameter, All writes 'all'", () => {
  assert.equal(countryParamForTab('ghana', 'ghana'), null);
  assert.equal(countryParamForTab('nigeria', 'ghana'), 'nigeria');
  assert.equal(countryParamForTab('', 'ghana'), 'all');
  assert.equal(countryParamForTab('', null), 'all');
});
