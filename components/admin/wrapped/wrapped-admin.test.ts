import { test } from 'node:test';
import assert from 'node:assert/strict';

import { studentParams } from '@/lib/api/admin-wrapped';
import type { WrappedAdminSummary } from '@/types/wrapped-admin';
import {
  campusLabel,
  CLEAR_FILTERS,
  editionLabel,
  filterUpdate,
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
  storyFunnels,
  storyFunnelSteps,
  storyLabel,
  trackingLine,
} from './wrapped-admin';

/* The Wrapped admin page's model (brief 384c 462b8946, Backend's contract
 * e717a1af and answers 8ef3c301). TEST DATA only. */

const SUMMARY: WrappedAdminSummary = {
  edition: 'bar-finals-2026',
  totals: { have: 200, opened: 100, finished: 40, shared: 10, shares: 14, notified: 0, hidden: 3, share_signups: 5 },
  reached: { '1': 100, '2': 90, '3': 80, '4': 70, '5': 60, '6': 55, '7': 50, '8': 40 },
  reached_by_story: {
    short: { have: 168, opened: 84, reached: { '1': 80, '7': 60, '8': 35 }, finished: 35, shared: 8 },
    full: {
      have: 32,
      opened: 16,
      reached: { '1': 16, '2': 15, '3': 14, '4': 12, '5': 10, '6': 9, '7': 8, '8': 5 },
      finished: 5,
      shared: 2,
    },
  },
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

test('each story has its own funnel, the full story first: the full story runs cards 1 to 8, the short story 1, 7 and the share card', () => {
  const funnels = storyFunnels(SUMMARY);
  assert.deepEqual(
    funnels.map((funnel) => [funnel.story, funnel.title, funnel.have]),
    [
      ['full', 'Full story', 32],
      ['short', 'Short story', 168],
    ]
  );
  assert.deepEqual(
    funnels[0].steps.map((step) => step.key),
    ['have', 'opened', 'card-1', 'card-2', 'card-3', 'card-4', 'card-5', 'card-6', 'card-7', 'card-8', 'finished', 'shared']
  );
  assert.deepEqual(
    funnels[1].steps.map((step) => step.label),
    ['Have this story', 'Opened it', 'Reached card 1', 'Reached card 7', 'Reached the share card', 'Finished', 'Shared']
  );
});

test('every step is against its own story’s students and the step before', () => {
  const [full, short] = storyFunnels(SUMMARY);
  assert.deepEqual(full.steps[0], { key: 'have', label: 'Have this story', count: 32, ofHave: 100, ofPrevious: null });
  assert.deepEqual(full.steps[1], { key: 'opened', label: 'Opened it', count: 16, ofHave: 50, ofPrevious: 50 });
  assert.deepEqual(short.steps[3], { key: 'card-7', label: 'Reached card 7', count: 60, ofHave: 36, ofPrevious: 75 });
  assert.deepEqual(short.steps.at(-1), { key: 'shared', label: 'Shared', count: 8, ofHave: 5, ofPrevious: 23 });
});

test('a card the server leaves out counts as 0, and a story with nobody shows dashes', () => {
  const steps = storyFunnelSteps('short', { have: 10, opened: 4, reached: { '1': 4 }, finished: 0, shared: 0 });
  assert.deepEqual(
    steps.map((step) => [step.key, step.count]),
    [
      ['have', 10],
      ['opened', 4],
      ['card-1', 4],
      ['card-7', 0],
      ['card-8', 0],
      ['finished', 0],
      ['shared', 0],
    ]
  );
  const nobody = { have: 0, opened: 0, reached: {}, finished: 0, shared: 0 };
  assert.ok(storyFunnelSteps('full', nobody).every((step) => step.ofHave === null));
  // A story the page does not know draws the cards the server counted, in order.
  assert.deepEqual(
    storyFunnelSteps('teaser', { ...nobody, have: 5, opened: 2, reached: { '8': 1, '1': 2 } }).map((step) => step.key),
    ['have', 'opened', 'card-1', 'card-8', 'finished', 'shared']
  );
  // An edition with no per-story counts shows no funnel rather than a wrong one.
  assert.deepEqual(storyFunnels({ ...SUMMARY, reached_by_story: undefined }), []);
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
