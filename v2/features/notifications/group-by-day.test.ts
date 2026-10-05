import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByDay, UNDATED_KEY } from './group-by-day';

/** Monday 5 October 2026, midday UTC. */
const NOW = Date.parse('2026-10-05T12:00:00Z');
const OPTIONS = { now: NOW, locale: 'en-GB', timeZone: 'UTC' };

const at = (iso: string) => ({ iso });
const group = (items: { iso: string }[], options = OPTIONS) =>
  groupByDay(items, (item) => item.iso, options);
const labels = (items: { iso: string }[], options = OPTIONS) =>
  group(items, options).map((day) => day.label);

test('today and yesterday are named', () => {
  assert.deepEqual(
    labels([at('2026-10-05T09:00:00Z'), at('2026-10-04T23:59:00Z')]),
    ['Today', 'Yesterday'],
  );
});

test('the five days before yesterday are weekdays', () => {
  assert.deepEqual(
    labels([
      at('2026-10-03T10:00:00Z'),
      at('2026-10-02T10:00:00Z'),
      at('2026-10-01T10:00:00Z'),
      at('2026-09-30T10:00:00Z'),
      at('2026-09-29T10:00:00Z'),
    ]),
    ['Saturday', 'Friday', 'Thursday', 'Wednesday', 'Tuesday'],
  );
});

test('a week ago and older is a date, with the year only when it differs', () => {
  assert.deepEqual(
    labels([at('2026-09-28T10:00:00Z'), at('2026-08-05T21:20:15+00:00'), at('2025-12-31T10:00:00Z')]),
    ['28 September', '5 August', '31 December 2025'],
  );
});

test('days are the reader’s calendar days, not 24-hour spans', () => {
  // 00:30 in Lagos (UTC+1) on the 5th is still the 4th in UTC.
  const lagos = { ...OPTIONS, timeZone: 'Africa/Lagos' };
  assert.deepEqual(labels([at('2026-10-04T23:30:00Z')], lagos), ['Today']);
  assert.deepEqual(labels([at('2026-10-04T23:30:00Z')]), ['Yesterday']);
});

test('rows keep their order, and a day is one group', () => {
  const days = group([
    at('2026-10-05T11:00:00Z'),
    at('2026-10-05T08:00:00Z'),
    at('2026-10-04T20:00:00Z'),
    at('2026-10-04T07:00:00Z'),
  ]);
  assert.deepEqual(
    days.map((day) => [day.key, day.items.map((item) => item.iso)]),
    [
      ['2026-10-05', ['2026-10-05T11:00:00Z', '2026-10-05T08:00:00Z']],
      ['2026-10-04', ['2026-10-04T20:00:00Z', '2026-10-04T07:00:00Z']],
    ],
  );
});

test('an unparseable timestamp lands in a trailing group instead of throwing', () => {
  const days = group([at('not a date'), at('2026-10-05T11:00:00Z'), at('')]);
  assert.deepEqual(
    days.map((day) => [day.key, day.label, day.items.length]),
    [
      ['2026-10-05', 'Today', 1],
      [UNDATED_KEY, 'Earlier', 2],
    ],
  );
});

test('no rows, no groups', () => {
  assert.deepEqual(group([]), []);
});
