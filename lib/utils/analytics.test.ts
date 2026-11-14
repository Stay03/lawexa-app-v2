import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bucketGranularity, bucketsSpanDays, formatDateTick, formatDateTooltipLabel, hourlyTicks, parseBucket } from './analytics';

/* The admin charts' time axis (Backend's analytics-time-of-day, 14 November
 * 2026): hourly points are "Y-m-d H:00", so two days' same hour stay apart.
 * TEST DATA only. */

test('a bucket key reads as its day and hour; the older forms read too', () => {
  assert.deepEqual(parseBucket('2026-11-14 22:00'), { day: '2026-11-14', hour: 22 });
  assert.deepEqual(parseBucket('2026-11-14 9'), { day: '2026-11-14', hour: 9 });
  assert.deepEqual(parseBucket('2026-11-14'), { day: '2026-11-14', hour: null });
  assert.equal(parseBucket('10'), null);
  assert.equal(parseBucket(''), null);
});

test('an hourly range across midnight spans two days; one day does not', () => {
  assert.equal(bucketsSpanDays(['2026-11-14 22:00', '2026-11-14 23:00', '2026-11-15 00:00', '2026-11-15 01:00']), true);
  assert.equal(bucketsSpanDays(['2026-11-15 00:00', '2026-11-15 01:00']), false);
  assert.equal(bucketsSpanDays([]), false);
});

test('hourly ticks are hours, and across midnight the midnight point names its day', () => {
  // 15 November 2026 is a Sunday.
  assert.equal(formatDateTick('2026-11-14 23:00', 'hour', true), '11 PM');
  assert.equal(formatDateTick('2026-11-15 00:00', 'hour', true), 'Sun 12 AM');
  assert.equal(formatDateTick('2026-11-15 01:00', 'hour', true), '1 AM');
  assert.equal(formatDateTick('2026-11-15 12:00', 'hour', true), '12 PM');
  // Within one day, midnight is only an hour.
  assert.equal(formatDateTick('2026-11-15 00:00', 'hour', false), '12 AM');
});

test('daily ticks and tooltips keep the day as written, whatever the time zone', () => {
  assert.equal(formatDateTick('2026-11-15', 'day'), 'Nov 15');
  assert.equal(formatDateTooltipLabel('2026-11-15', 'day'), 'November 15, 2026');
});

test("an hourly tooltip names the day and the hour, so the two days' same hour read apart", () => {
  assert.equal(formatDateTooltipLabel('2026-11-14 23:00', 'hour'), 'Sat, Nov 14, 11 PM');
  assert.equal(formatDateTooltipLabel('2026-11-15 23:00', 'hour'), 'Sun, Nov 15, 11 PM');
});

test('a key it cannot read is shown as it came, never as "Invalid Date"', () => {
  assert.equal(formatDateTick('10', 'hour'), '10');
  assert.equal(formatDateTooltipLabel('soon', 'day'), 'soon');
});

test('a series with no granularity of its own reads it off its keys', () => {
  assert.equal(bucketGranularity(['2026-11-14 23:00', '2026-11-15 00:00']), 'hour');
  assert.equal(bucketGranularity(['2026-11-14', '2026-11-15']), 'day');
  assert.equal(bucketGranularity([]), 'day');
});

test('across midnight the axis ticks every third hour, so midnight is always labelled', () => {
  const day = Array.from({ length: 24 }, (_, i) => {
    const hour = (10 + i) % 24;
    return `2026-11-${10 + i < 24 ? 14 : 15} ${String(hour).padStart(2, '0')}:00`;
  });
  assert.deepEqual(hourlyTicks(day, true), [
    '2026-11-14 12:00', '2026-11-14 15:00', '2026-11-14 18:00', '2026-11-14 21:00',
    '2026-11-15 00:00', '2026-11-15 03:00', '2026-11-15 06:00', '2026-11-15 09:00',
  ]);
  // Within one day, or daily, the chart picks its own.
  assert.equal(hourlyTicks(day, false), undefined);
});
