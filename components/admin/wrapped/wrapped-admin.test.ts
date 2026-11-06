import { test } from 'node:test';
import assert from 'node:assert/strict';

import { studentParams } from '@/lib/api/admin-wrapped';
import type { WrappedAdminSummary } from '@/types/wrapped-admin';
import {
  campusLabel,
  CLEAR_FILTERS,
  editionLabel,
  filterUpdate,
  funnelSteps,
  isFiltered,
  isFilterableCampus,
  lagosTime,
  pageUpdate,
  percentOf,
  percentText,
  personaLabel,
  progressText,
  readStudentView,
  splitRows,
  storyLabel,
  trackingLine,
} from './wrapped-admin';

/* The Wrapped admin page's model (brief 384c 462b8946, Backend's contract
 * e717a1af and answers 8ef3c301). TEST DATA only. */

const SUMMARY: WrappedAdminSummary = {
  edition: 'bar-finals-2026',
  totals: { have: 200, opened: 100, finished: 40, shared: 10, shares: 14, notified: 0, hidden: 3, share_signups: 5 },
  reached: { '1': 100, '2': 90, '3': 80, '4': 70, '5': 60, '6': 55, '7': 50, '8': 40 },
  by_persona: {
    drafting_don: { have: 50, opened: 20, finished: 9, shared: 3 },
    section_quoter: { have: 80, opened: 50, finished: 20, shared: 5 },
    brand_new_persona: { have: 70, opened: 30, finished: 11, shared: 2 },
  },
  by_campus: {
    unknown: { have: 120, opened: 10, finished: 1, shared: 0 },
    lagos: { have: 60, opened: 70, finished: 30, shared: 8 },
    port_harcourt: { have: 20, opened: 20, finished: 9, shared: 2 },
  },
  tracking_since: '2026-11-06T12:05:00+00:00',
};

test('a percentage is whole, and a share of nothing is a dash, never 0% or NaN%', () => {
  assert.equal(percentOf(1, 3), 33);
  assert.equal(percentOf(2, 3), 67);
  assert.equal(percentOf(0, 10), 0);
  assert.equal(percentOf(5, 0), null);
  assert.equal(percentOf(Number.NaN, 10), null);
  assert.equal(percentText(null), '—');
  assert.equal(percentText(42), '42%');
});

test('the funnel runs have, opened, cards 1 to 8, finished, shared, each against have and the step before', () => {
  const steps = funnelSteps(SUMMARY);
  assert.deepEqual(
    steps.map((step) => step.key),
    ['have', 'opened', 'card-1', 'card-2', 'card-3', 'card-4', 'card-5', 'card-6', 'card-7', 'card-8', 'finished', 'shared']
  );
  assert.deepEqual(steps[0], { key: 'have', label: 'Have a Wrapped', count: 200, ofHave: 100, ofPrevious: null });
  assert.deepEqual(steps[1], { key: 'opened', label: 'Opened it', count: 100, ofHave: 50, ofPrevious: 50 });
  assert.equal(steps[3].label, 'Reached card 2');
  assert.equal(steps[3].ofPrevious, 90);
  assert.deepEqual(steps.at(-1), { key: 'shared', label: 'Shared', count: 10, ofHave: 5, ofPrevious: 25 });
});

test('a card the summary leaves out counts as 0, and an edition with nobody shows dashes', () => {
  const steps = funnelSteps({ ...SUMMARY, reached: {} });
  assert.equal(steps.find((step) => step.key === 'card-4')?.count, 0);
  const empty = funnelSteps({
    ...SUMMARY,
    totals: { ...SUMMARY.totals, have: 0, opened: 0, finished: 0, shared: 0 },
    reached: {},
  });
  assert.ok(empty.every((step) => step.ofHave === null));
});

test('personas and campuses read as the story names them; an unknown key shows as sent', () => {
  assert.equal(personaLabel('drafting_don'), 'The Drafting Don');
  assert.equal(personaLabel('brand_new_persona'), 'brand_new_persona');
  assert.equal(campusLabel('port_harcourt'), 'Port Harcourt');
  assert.equal(campusLabel('unknown'), 'No campus');
  assert.equal(campusLabel(null), 'No campus');
  assert.equal(campusLabel('ibadan'), 'ibadan');
  assert.equal(isFilterableCampus('lagos'), true);
  assert.equal(isFilterableCampus('unknown'), false);
  assert.equal(storyLabel('full'), 'Full');
  assert.equal(storyLabel('short'), 'Short');
});

test('a split lists the biggest group first, with "No campus" last whatever its size', () => {
  const personas = splitRows(SUMMARY.by_persona, personaLabel);
  assert.deepEqual(
    personas.map((row) => row.key),
    ['section_quoter', 'brand_new_persona', 'drafting_don']
  );
  assert.equal(personas[0].openedRate, 63);
  const campuses = splitRows(SUMMARY.by_campus, campusLabel);
  assert.deepEqual(
    campuses.map((row) => row.key),
    ['lagos', 'port_harcourt', 'unknown']
  );
  assert.equal(campuses[0].label, 'Lagos');
  assert.equal(campuses[2].sharedRate, 0);
});

test('the list view reads from the URL and falls back to "all" for anything it cannot read', () => {
  const view = (query: string) => readStudentView(new URLSearchParams(query));
  assert.deepEqual(view(''), { status: null, persona: null, campus: null, search: '', page: 1 });
  assert.deepEqual(view('status=finished&persona=drafting_don&campus=lagos&search=Ada&page=3'), {
    status: 'finished',
    persona: 'drafting_don',
    campus: 'lagos',
    search: 'Ada',
    page: 3,
  });
  assert.equal(view('status=everything').status, null);
  assert.equal(view('page=0').page, 1);
  assert.equal(view('page=abc').page, 1);
});

test('a filter change resets the page; page 1 leaves no page in the URL; Clear empties every filter', () => {
  assert.deepEqual(filterUpdate({ persona: 'drafting_don' }), { page: null, persona: 'drafting_don' });
  assert.deepEqual(filterUpdate({ campus: null }), { page: null, campus: null });
  assert.deepEqual(pageUpdate(1), { page: null });
  assert.deepEqual(pageUpdate(4), { page: '4' });
  assert.deepEqual(Object.keys(CLEAR_FILTERS).sort(), ['campus', 'page', 'persona', 'search', 'status']);
  assert.equal(isFiltered({ status: null, persona: null, campus: null, search: '  ', page: 2 }), false);
  assert.equal(isFiltered({ status: 'shared', persona: null, campus: null, search: '', page: 1 }), true);
});

test('the request names only the filters chosen, with the search trimmed', () => {
  assert.deepEqual(
    studentParams({ status: null, persona: null, campus: null, search: '  ', page: 1, per_page: 25 }),
    { page: 1, per_page: 25 }
  );
  assert.deepEqual(
    studentParams({ status: 'not_opened', persona: 'drafting_don', campus: 'abuja', search: ' Ada ', page: 2, per_page: 25 }),
    { page: 2, per_page: 25, status: 'not_opened', persona: 'drafting_don', campus: 'abuja', search: 'Ada' }
  );
});

test('progress reads in words: not opened, opened, card n of 8, finished', () => {
  assert.equal(progressText({ first_opened_at: null, last_card: null, finished_at: null }), 'Not opened');
  assert.equal(progressText({ first_opened_at: '2026-11-06T12:00:00Z', last_card: null, finished_at: null }), 'Opened');
  assert.equal(progressText({ first_opened_at: '2026-11-06T12:00:00Z', last_card: 5, finished_at: null }), 'Card 5 of 8');
  assert.equal(
    progressText({ first_opened_at: '2026-11-06T12:00:00Z', last_card: 8, finished_at: '2026-11-06T12:04:00Z' }),
    'Finished'
  );
});

test('times read in Lagos time, and the header says from when opens are counted', () => {
  assert.equal(lagosTime('2026-11-06T12:05:00+00:00'), '6 Nov, 13:05 WAT');
  assert.equal(lagosTime(null), null);
  assert.equal(lagosTime('not a time'), null);
  assert.equal(
    trackingLine('2026-11-06T12:05:00+00:00'),
    'Opens counted since 6 Nov, 13:05 WAT. Opens before then were not recorded.'
  );
  assert.equal(trackingLine(null), 'No opens recorded yet.');
  assert.equal(editionLabel('bar-finals-2026'), 'Bar Finals 2026');
  assert.equal(editionLabel('call-to-bar-2026'), 'call-to-bar-2026');
});
