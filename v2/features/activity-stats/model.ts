/**
 * The stats page's data (`GET /api/me/activity?period=`, backend's
 * `activity-page` branch, 20 October 2026) and the pure shaping the page draws
 * from it. Every number is the server's; nothing is counted here.
 */

/** The periods Stay chose (29 September 2026): 12, 6 and 3 months, and 30 days. */
export const STATS_PERIODS = [
  { id: '12m', label: '12 months' },
  { id: '6m', label: '6 months' },
  { id: '3m', label: '3 months' },
  { id: '30d', label: '30 days' },
] as const;

export type StatsPeriod = (typeof STATS_PERIODS)[number]['id'];

export const DEFAULT_STATS_PERIOD: StatsPeriod = '12m';

export interface StatsDay {
  /** YYYY-MM-DD in the reader's own time zone. */
  date: string;
  count: number;
}

export interface StatsTotals {
  chats_started: number;
  messages_sent: number;
  cases_read: number;
  statutes_read: number;
  notes_read: number;
  notes_written: number;
  quizzes_started: number;
  quizzes_finished: number;
  /** Null when no quiz was finished. */
  quiz_average_score: number | null;
  active_days: number;
}

export interface StatsData {
  period: StatsPeriod;
  /** The period's first and last day, in the reader's own calendar. */
  from: string;
  to: string;
  timezone: string;
  /** For the chosen period. */
  totals: StatsTotals;
  /** Over the reader's whole history. */
  lifetime: StatsTotals;
  /** Over the whole history, whatever the period; today with nothing yet keeps a streak. */
  streak: {
    current: number;
    current_from: string | null;
    longest: number;
    longest_from: string | null;
    longest_to: string | null;
  };
  /** Every day of the period, oldest first, today last. */
  days: StatsDay[];
  generated_at: string;
}

/** One square: a day, or an empty slot before the first day of the grid. */
export type GridCell = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 } | null;

export interface StatsGrid {
  /** Columns of seven, Sunday at the top, oldest week first. */
  weeks: GridCell[][];
  /** Where each month's label starts: the week index and the month's short name. */
  months: { week: number; label: string }[];
}

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });

/**
 * The days as week columns, Sunday first, the first column padded so every
 * day sits on its own weekday row. The shade is set against the reader's own
 * busiest day (quarters of their maximum), so a light user's grid is never all
 * pale and a heavy user's never all dark.
 */
export function statsGrid(days: readonly StatsDay[]): StatsGrid {
  const max = days.reduce((top, day) => Math.max(top, day.count), 0);
  const level = (count: number): 0 | 1 | 2 | 3 | 4 => {
    if (count <= 0 || max === 0) return 0;
    const share = count / max;
    if (share > 0.75) return 4;
    if (share > 0.5) return 3;
    if (share > 0.25) return 2;
    return 1;
  };

  const weeks: GridCell[][] = [];
  const months: { week: number; label: string }[] = [];
  let column: GridCell[] = [];
  let lastMonth = -1;

  days.forEach((day, index) => {
    const at = new Date(`${day.date}T00:00:00Z`);
    const weekday = at.getUTCDay();
    if (index === 0) for (let pad = 0; pad < weekday; pad += 1) column.push(null);
    else if (weekday === 0) {
      weeks.push(column);
      column = [];
    }
    if (at.getUTCMonth() !== lastMonth) {
      lastMonth = at.getUTCMonth();
      const week = weeks.length;
      // A month starting in the same column as the previous label would
      // overlap it, so the earlier one gives way.
      if (months.length > 0 && months[months.length - 1].week === week) months.pop();
      months.push({ week, label: MONTH.format(at) });
    }
    column.push({ date: day.date, count: day.count, level: level(day.count) });
  });
  if (column.length > 0) weeks.push(column);
  return { weeks, months };
}

/** "1.2k" from a thousand, the number itself below. */
export function compactCount(value: number): string {
  if (value < 1000) return String(value);
  const thousands = value / 1000;
  return `${thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10}k`;
}

/** "1 day", "12 days". */
export function dayCount(value: number): string {
  return `${value} ${value === 1 ? 'day' : 'days'}`;
}

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** A YYYY-MM-DD calendar date as "3 Oct", read as the date it names. */
export function shortDate(date: string | null): string {
  if (!date) return '';
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(time) ? '' : SHORT_DATE.format(time);
}

const LONG_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** A YYYY-MM-DD calendar date as "3 Oct 2026", for a period that can span two years. */
export function longDate(date: string | null): string {
  if (!date) return '';
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(time) ? '' : LONG_DATE.format(time);
}

/** The line under a streak: "Since 3 Oct", "3 Oct to 9 Oct", or nothing for none. */
export function streakSpan(length: number, from: string | null, to?: string | null): string {
  if (length === 0 || !from) return '';
  if (to === undefined) return `Since ${shortDate(from)}`;
  return to && to !== from ? `${shortDate(from)} to ${shortDate(to)}` : shortDate(from);
}
