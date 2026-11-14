/**
 * The admin analytics charts' time axis (Backend's analytics-time-of-day, 14
 * November 2026). Every point names its bucket under `date`: "Y-m-d" for a
 * day, "Y-m-d H:00" for an hour. The hour used to come alone ("10"), so the
 * same hour on two days ("last 24 hours" across midnight) was one point.
 *
 * Keys are read as the server's own calendar, never through `new Date(key)`,
 * which reads "Y-m-d" as midnight UTC and can show the day before.
 */

export type Granularity = 'hour' | 'day';

/** A bucket key's parts: its day ("2026-11-14") and its hour, or null for a day. */
export interface Bucket {
  day: string;
  hour: number | null;
}

/** Reads "Y-m-d", "Y-m-d H:00", or the older "Y-m-d H". Null for anything else. */
export function parseBucket(value: string): Bucket | null {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2})(?::\d{2})?)?$/.exec(value.trim());
  if (!match) return null;
  const hour = match[2] === undefined ? null : Number(match[2]);
  return { day: match[1], hour: hour !== null && hour >= 0 && hour <= 23 ? hour : null };
}

/** The bucket's moment on the local calendar (the server's day and hour, as written). */
function localDate(bucket: Bucket): Date {
  const [year, month, day] = bucket.day.split('-').map(Number);
  return new Date(year, month - 1, day, bucket.hour ?? 0);
}

/** "2 PM", "12 AM". */
function hourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/**
 * A series' granularity read off its keys, for a chart whose response names
 * none (notifications, lawyer requests): an hour in the key means hourly.
 */
export function bucketGranularity(values: readonly string[]): Granularity {
  return values.some((value) => parseBucket(value)?.hour != null) ? 'hour' : 'day';
}

/** Whether a series' points fall on more than one day: an hourly range across midnight. */
export function bucketsSpanDays(values: readonly string[]): boolean {
  const days = new Set(values.map((value) => parseBucket(value)?.day).filter((day): day is string => day !== undefined));
  return days.size > 1;
}

/**
 * An axis tick. Hourly: the hour ("2 PM"); where the range crosses midnight,
 * the midnight point also names its day ("Sat 12 AM"), so the two days read
 * apart. Daily: "Nov 14".
 */
export function formatDateTick(value: string, granularity: Granularity, spansDays = false): string {
  const bucket = parseBucket(value);
  if (!bucket) return value;
  const date = localDate(bucket);
  if (granularity === 'hour' && bucket.hour !== null) {
    const hour = hourLabel(bucket.hour);
    if (spansDays && bucket.hour === 0) return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${hour}`;
    return hour;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** A tooltip's heading. Hourly: the day and the hour ("Sat, Nov 15, 2 PM"). Daily: "November 15, 2026". */
export function formatDateTooltipLabel(value: string, granularity: Granularity): string {
  const bucket = parseBucket(value);
  if (!bucket) return value;
  const date = localDate(bucket);
  if (granularity === 'hour' && bucket.hour !== null) {
    return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${hourLabel(bucket.hour)}`;
  }
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
