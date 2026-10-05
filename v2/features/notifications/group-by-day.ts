/**
 * group-by-day — the inbox's day headers, as a pure function.
 *
 * Labels, newest first: "Today", "Yesterday", the weekday name for the five
 * days before that, then the date ("29 September", with the year once it is not
 * this year). That is the order a reader triages an inbox in: the recent days
 * by name, everything older by date.
 *
 * ── DAYS ARE CALENDAR DAYS IN THE READER'S ZONE ────────────────────────────
 * "Yesterday" means the previous date on the reader's own calendar, not 24
 * hours ago: a mention at 23:50 is yesterday at 00:10. So both the row and `now`
 * are reduced to a `YYYY-MM-DD` in `timeZone` first, and the distance is counted
 * in whole dates. `locale` and `timeZone` are parameters (undefined means the
 * runtime's own) so the labels are checkable without a clock or a browser.
 *
 * Because the answer depends on the reader's zone, it must never be computed on
 * the server: the inbox renders rows only once mounted (`NotificationsInbox`).
 *
 * A row whose timestamp does not parse is not dropped and does not throw: it
 * lands in one trailing "Earlier" group, after every dated one.
 */

export interface DayGroup<T> {
  /** `YYYY-MM-DD` in the reader's zone, or {@link UNDATED_KEY}. */
  key: string;
  label: string;
  items: T[];
}

export interface GroupByDayOptions {
  now: number;
  locale?: string;
  timeZone?: string;
}

export const UNDATED_KEY = 'undated';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Formats a time as the calendar date it falls on in `timeZone`, as
 *  `YYYY-MM-DD`. `en-CA` writes dates in exactly that order, whatever the
 *  reader's own locale. Built once per call, not once per row. */
function dateKeyFormat(timeZone: string | undefined): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** Whole calendar days from `earlier` to `later`, both `YYYY-MM-DD`. */
function daysBetween(earlier: string, later: string): number {
  return Math.round((Date.parse(later) - Date.parse(earlier)) / DAY_MS);
}

function dayLabel(
  time: number,
  key: string,
  todayKey: string,
  { locale, timeZone }: GroupByDayOptions,
): string {
  const daysAgo = daysBetween(key, todayKey);
  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 7) {
    return new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long' }).format(time);
  }
  const sameYear = key.slice(0, 4) === todayKey.slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'long',
    ...(sameYear ? null : { year: 'numeric' }),
  }).format(time);
}

/**
 * Group `items` (newest first) under day headers. Order is kept: groups appear
 * in the order their first item does, and items keep their order inside each.
 */
export function groupByDay<T>(
  items: readonly T[],
  timestampOf: (item: T) => string,
  options: GroupByDayOptions,
): DayGroup<T>[] {
  const dateKey = dateKeyFormat(options.timeZone);
  const todayKey = dateKey.format(options.now);
  const groups = new Map<string, DayGroup<T>>();
  let undated: DayGroup<T> | null = null;

  for (const item of items) {
    const time = Date.parse(timestampOf(item));
    if (Number.isNaN(time)) {
      undated ??= { key: UNDATED_KEY, label: 'Earlier', items: [] };
      undated.items.push(item);
      continue;
    }
    const key = dateKey.format(time);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dayLabel(time, key, todayKey, options), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  const ordered = [...groups.values()];
  if (undated) ordered.push(undated);
  return ordered;
}
