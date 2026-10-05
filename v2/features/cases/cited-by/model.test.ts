import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CitingCase } from '@/types/case';
import {
  CITED_BY_PREVIEW_COUNT,
  DEFAULT_CITED_BY_QUERY,
  YEAR_CHIPS_FOLDED,
  citedByParams,
  citedBySummary,
  citedByTotal,
  citingCaseItem,
  flattenCitingPages,
  isNarrowed,
  needsFullList,
  panelOpenIn,
  panelParam,
  seeAllLabel,
  visibleYears,
} from './model';

const row = (over: Partial<CitingCase>): CitingCase => ({
  id: 1,
  title: 'Buhari v Obasanjo',
  short_title: null,
  display_title: 'Buhari v Obasanjo (2005) 13 NWLR (Pt. 941) 1',
  slug: 'buhari-v-obasanjo',
  judgment_date: '2005-07-01',
  citation: '(2005) 13 NWLR (Pt. 941) 1',
  court: 'Supreme Court of Nigeria',
  cited_by_count: 40,
  treatment: null,
  is_bookmarked: false,
  bookmarks_count: 0,
  views_count: 0,
  ...over,
});

test('the heading counts the real total, not the 50 rows the payload carries', () => {
  const rows = Array.from({ length: 50 }, () => ({}) as never);
  assert.equal(citedByTotal({ cited_by: rows, cited_by_count: 462 }), 462);
});

test('a payload without the count falls back to its rows, and a lagging count never undercounts', () => {
  const rows = Array.from({ length: 7 }, () => ({}) as never);
  assert.equal(citedByTotal({ cited_by: rows }), 7);
  assert.equal(citedByTotal({ cited_by: rows, cited_by_count: 3 }), 7);
  assert.equal(citedByTotal({ cited_by: null }), 0);
});

test('the panel exists only when the preview cannot hold every citing case', () => {
  assert.equal(needsFullList(CITED_BY_PREVIEW_COUNT), false);
  assert.equal(needsFullList(CITED_BY_PREVIEW_COUNT + 1), true);
  assert.equal(seeAllLabel(462), 'See all 462');
});

test('opening writes the panel into the URL and closing takes it out, so Back closes it', () => {
  assert.deepEqual(panelParam(true), { 'cited-by': 'all' });
  assert.deepEqual(panelParam(false), { 'cited-by': null });
  // The entry the open pushed, then the one Back returns to.
  assert.equal(panelOpenIn('?cited-by=all'), true);
  assert.equal(panelOpenIn('?q=estoppel&cited-by=all'), true);
  assert.equal(panelOpenIn(''), false);
  assert.equal(panelOpenIn('?q=estoppel'), false);
});

test('a citing row reads name, then citation, court and year, and links to its case', () => {
  const item = citingCaseItem(row({ treatment: 'distinguished' }));
  assert.equal(item.key, 'case-1');
  assert.equal(item.name, 'Buhari v Obasanjo');
  assert.equal(item.href, '/cases/buhari-v-obasanjo');
  assert.equal(item.reference, '(2005) 13 NWLR (Pt. 941) 1 · Supreme Court of Nigeria · 2005');
  assert.equal(item.badge?.label, 'Distinguished');
});

test('a plain "referred to" carries no badge, and a row with nothing to cite has no reference', () => {
  const item = citingCaseItem(
    row({ treatment: 'referred_to', citation: null, court: null, judgment_date: null }),
  );
  assert.equal(item.badge, null);
  assert.equal(item.reference, null);
});

test('pages flatten in order and a row that slid across a page boundary appears once', () => {
  const pages = [
    { data: [row({ id: 1 }), row({ id: 2 })] },
    { data: [row({ id: 2 }), row({ id: 3 })] },
  ];
  assert.deepEqual(
    flattenCitingPages(pages).map((r) => r.id),
    [1, 2, 3],
  );
  assert.deepEqual(flattenCitingPages(undefined), []);
});

test('the request leaves off a blank search and any "any" filter', () => {
  assert.deepEqual(citedByParams(DEFAULT_CITED_BY_QUERY), { sort: 'most_cited' });
  assert.deepEqual(
    citedByParams({ sort: 'newest', search: '  ojukwu ', courtId: 2, year: 2024 }),
    { sort: 'newest', search: 'ojukwu', court_id: 2, year: 2024 },
  );
  assert.deepEqual(citedByParams({ ...DEFAULT_CITED_BY_QUERY, search: '   ' }), {
    sort: 'most_cited',
  });
});

test('search, court and year narrow the list; sort does not', () => {
  assert.equal(isNarrowed(DEFAULT_CITED_BY_QUERY), false);
  assert.equal(isNarrowed({ ...DEFAULT_CITED_BY_QUERY, sort: 'newest' }), false);
  assert.equal(isNarrowed({ ...DEFAULT_CITED_BY_QUERY, search: ' ' }), false);
  assert.equal(isNarrowed({ ...DEFAULT_CITED_BY_QUERY, courtId: 2 }), true);
  assert.equal(isNarrowed({ ...DEFAULT_CITED_BY_QUERY, year: 1999 }), true);
});

const years = Array.from({ length: 20 }, (_, index) => ({ year: 2025 - index, count: 3 }));

test('folded year chips show the newest few and say how many wait behind the fold', () => {
  const { shown, hidden } = visibleYears(years, null, false);
  assert.deepEqual(
    shown.map((entry) => entry.year),
    [2025, 2024, 2023, 2022, 2021, 2020],
  );
  assert.equal(hidden, 20 - YEAR_CHIPS_FOLDED);
});

test('a chosen year older than the fold stays in view, and unfolded shows every year', () => {
  const folded = visibleYears(years, 2010, false);
  assert.equal(folded.shown.at(-1)?.year, 2010);
  assert.equal(folded.hidden, 20 - YEAR_CHIPS_FOLDED - 1);
  assert.equal(visibleYears(years, 2010, true).shown.length, 20);
  assert.equal(visibleYears(years.slice(0, 4), null, false).hidden, 0);
});

test('the summary names the total, or how many of it match', () => {
  assert.equal(citedBySummary(462, 462, false), '462 later judgments cite this case');
  assert.equal(citedBySummary(12, 462, true), '12 of 462 citing cases match');
  assert.equal(citedBySummary(1, 462, true), '1 of 462 citing cases matches');
  assert.equal(citedBySummary(1, 1, false), '1 later judgment cites this case');
});
