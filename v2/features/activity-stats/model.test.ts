import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pushedScreenFor } from '@/v2/shell/pushed-route';
import { V2_ROUTES } from '@/v2/routes.manifest';
import { SETTINGS_GROUPS } from '@/v2/features/settings/rows';
import {
  STATS_PERIODS,
  dayCount,
  longDate,
  shortDate,
  statsGrid,
  streakSpan,
} from './model';

/* The Activity stats page (Stay, 29 September 2026; built 20 October 2026 on
 * backend's GET /me/activity): lifetime totals, streaks, a daily grid, and a
 * switch between 12, 6 and 3 months and 30 days. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the switch offers Stay’s four periods, in his order', () => {
  assert.deepEqual(STATS_PERIODS.map((p) => p.id), ['12m', '6m', '3m', '30d']);
  assert.deepEqual(STATS_PERIODS.map((p) => p.label), ['12 months', '6 months', '3 months', '30 days']);
});

test('the grid puts each day on its weekday row, Sunday first, and shades against the busiest day', () => {
  // 2026-10-01 is a Thursday: four empty slots before it.
  const days = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, count: i }));
  const grid = statsGrid(days);
  assert.equal(grid.weeks[0].length, 7);
  assert.deepEqual(grid.weeks[0].slice(0, 4), [null, null, null, null]);
  assert.equal(grid.weeks[0][4]?.date, '2026-10-01');
  assert.equal(grid.weeks[1][0]?.date, '2026-10-04');
  assert.equal(grid.weeks[0][4]?.level, 0);
  assert.equal(grid.weeks[1][5]?.level, 4);
  assert.deepEqual(grid.months, [{ week: 0, label: 'Oct' }]);
  // A month that starts within three columns of the last label takes its
  // place, so "Sept" and "Oct" never print over each other (30 days from 21 Sept).
  const thirty = Array.from({ length: 30 }, (_, i) => {
    const at = new Date(Date.UTC(2026, 8, 21 + i));
    return { date: at.toISOString().slice(0, 10), count: 1 };
  });
  assert.deepEqual(statsGrid(thirty).months, [{ week: 1, label: 'Oct' }]);
  // Nothing at all: every square is the empty shade.
  assert.ok(statsGrid([{ date: '2026-10-01', count: 0 }]).weeks[0].every((cell) => cell === null || cell.level === 0));
});

test('numbers and dates read the way the page prints them', () => {
  assert.equal(dayCount(1), '1 day');
  assert.equal(dayCount(12), '12 days');
  assert.equal(shortDate('2026-10-03'), '3 Oct');
  assert.equal(longDate('2025-10-21'), '21 Oct 2025');
  assert.equal(shortDate(null), '');
  assert.equal(streakSpan(5, '2026-10-16'), 'Since 16 Oct');
  assert.equal(streakSpan(7, '2026-10-03', '2026-10-09'), '3 Oct to 9 Oct');
  assert.equal(streakSpan(1, '2026-10-03', '2026-10-03'), '3 Oct');
  assert.equal(streakSpan(0, null), '');
});

test('the page shows all-time totals, both streaks, the switch, the grid and the period’s counts', () => {
  const screen = read('v2', 'features', 'activity-stats', 'StatsScreen.tsx');
  assert.match(screen, /<TotalsGrid totals=\{data\.lifetime\} \/>/);
  // Exact numbers: "1,973", never "2k" (first pictures, 20 October 2026).
  assert.match(screen, /\{value\.toLocaleString\('en-GB'\)\}/);
  // A year fits a computer's column: 10 px squares, 2 px gaps.
  assert.match(screen, /className=\{cn\('size-2\.5 rounded-\[2px\]', LEVEL\[cell\.level\]\)\}/);
  assert.match(screen, /label="Current streak"/);
  assert.match(screen, /label="Longest streak"/);
  assert.match(screen, /<TabRow\s+tabs=\{STATS_PERIODS\}/);
  assert.match(screen, /<ActiveDays grid=\{grid\}/);
  assert.match(screen, /<Row label="Chats started" value=\{data\.totals\.chats_started\} \/>/);
  // The extras the ask did not name stay out.
  assert.doesNotMatch(screen, /data\.(top_tools|insights)/);
  const queries = read('v2', 'features', 'activity-stats', 'queries.ts');
  assert.match(queries, /apiClient\.get<ApiResponse<StatsData>>\('\/me\/activity', \{ params: \{ period \} \}\)/);
  assert.match(queries, /placeholderData: keepPreviousData,/);
});

test('it lives at /activity/stats, opened from Settings, for an account', () => {
  assert.ok(V2_ROUTES.includes('/activity/stats'));
  assert.deepEqual(
    { ...pushedScreenFor('/activity/stats'), title: undefined },
    { backHref: '/settings', backLabel: 'Back to settings', title: undefined },
  );
  const row = SETTINGS_GROUPS.flatMap((group) => group.rows).find((entry) => entry.id === 'stats');
  assert.equal(row?.href, '/activity/stats');
  assert.equal(row?.label, 'Your stats');
  assert.equal(row?.requiresAccount, true);
});
