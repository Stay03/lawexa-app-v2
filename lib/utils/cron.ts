/**
 * Minimal 5-field cron utilities for the radar schedule picker.
 * Supports the standard syntax the backend accepts: `*`, single values,
 * ranges (a-b), steps (*\/s, a-b/s), and comma lists. No named values.
 */

export interface CronFields {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
}

interface FieldSpec {
  min: number;
  max: number;
}

const FIELD_SPECS: readonly FieldSpec[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 7 }, // day of week (7 normalizes to 0 = Sunday)
];

function parseField(field: string, spec: FieldSpec, isDayOfWeek: boolean): Set<number> | null {
  const values = new Set<number>();

  for (const part of field.split(',')) {
    if (part.length === 0) return null;

    const [rangePart, stepPart, ...rest] = part.split('/');
    if (rest.length > 0 || stepPart === '') return null;

    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) return null;

    let start: number;
    let end: number;

    if (rangePart === '*') {
      start = spec.min;
      end = spec.max;
    } else if (/^\d+$/.test(rangePart)) {
      start = Number(rangePart);
      end = stepPart === undefined ? start : spec.max;
    } else {
      const match = /^(\d+)-(\d+)$/.exec(rangePart);
      if (!match) return null;
      start = Number(match[1]);
      end = Number(match[2]);
    }

    if (start < spec.min || end > spec.max || start > end) return null;

    for (let value = start; value <= end; value += step) {
      values.add(isDayOfWeek && value === 7 ? 0 : value);
    }
  }

  return values.size > 0 ? values : null;
}

/**
 * Parse a strict 5-field cron expression. Returns null when invalid.
 */
export function parseCronExpression(expression: string): CronFields | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;

  const parsed = fields.map((field, index) =>
    parseField(field, FIELD_SPECS[index], index === 4)
  );
  if (parsed.some((field) => field === null)) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parsed as Set<number>[];
  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function formatTime(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}

/** "1st" / "2nd" / "23rd" — exported for the schedule pickers' month-day
 *  labels, so the copy here and in `describeCron` cannot drift. */
export function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function isFullRange(values: Set<number>, spec: FieldSpec): boolean {
  return values.size === spec.max - spec.min + 1;
}

function setEquals(values: Set<number>, expected: readonly number[]): boolean {
  return (
    values.size === expected.length && expected.every((value) => values.has(value))
  );
}

/**
 * Humanize the common cron shapes (daily, weekdays, weekly, monthly,
 * every N minutes/hours). Returns null for anything more exotic — callers
 * should fall back to showing the raw expression.
 */
export function describeCron(expression: string): string | null {
  const fields = parseCronExpression(expression);
  if (fields === null) return null;

  const { minute, hour, dayOfMonth, month, dayOfWeek } = fields;
  const everyDayOfMonth = isFullRange(dayOfMonth, FIELD_SPECS[2]);
  const everyMonth = isFullRange(month, FIELD_SPECS[3]);
  const everyDayOfWeek = dayOfWeek.size === 7;

  if (!everyMonth) return null;

  // Single fixed time of day
  if (minute.size === 1 && hour.size === 1) {
    const time = formatTime([...hour][0], [...minute][0]);

    if (everyDayOfMonth && everyDayOfWeek) return `Daily at ${time}`;

    if (everyDayOfMonth && !everyDayOfWeek) {
      if (setEquals(dayOfWeek, [1, 2, 3, 4, 5])) return `Weekdays at ${time}`;
      if (setEquals(dayOfWeek, [0, 6])) return `Weekends at ${time}`;
      if (dayOfWeek.size === 1) {
        return `Weekly on ${WEEKDAY_NAMES[[...dayOfWeek][0]]} at ${time}`;
      }
      const names = [...dayOfWeek]
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_NAMES[day]);
      return `Every ${names.join(', ')} at ${time}`;
    }

    if (!everyDayOfMonth && everyDayOfWeek && dayOfMonth.size === 1) {
      return `Monthly on the ${ordinal([...dayOfMonth][0])} at ${time}`;
    }

    return null;
  }

  // Interval shapes — only when day/week fields are unrestricted
  if (!everyDayOfMonth || !everyDayOfWeek) return null;

  if (isFullRange(hour, FIELD_SPECS[1])) {
    if (isFullRange(minute, FIELD_SPECS[0])) return 'Every minute';
    const minutes = [...minute].sort((a, b) => a - b);
    if (minutes.length === 1) {
      return minutes[0] === 0
        ? 'Every hour'
        : `Every hour at :${minutes[0].toString().padStart(2, '0')}`;
    }
    if (minutes.length > 1) {
      const interval = minutes[1] - minutes[0];
      const evenlySpaced =
        minutes.every((value, index) => value === minutes[0] + index * interval) &&
        60 % interval === 0 &&
        minutes.length === 60 / interval;
      if (evenlySpaced) return `Every ${interval} minutes`;
    }
    return null;
  }

  if (minute.size === 1 && [...minute][0] === 0 && hour.size > 1) {
    const hours = [...hour].sort((a, b) => a - b);
    const interval = hours[1] - hours[0];
    const evenlySpaced =
      hours.every((value, index) => value === hours[0] + index * interval) &&
      hours[0] === 0 &&
      24 % interval === 0;
    if (evenlySpaced) return `Every ${interval} hours`;
  }

  return null;
}

// A fixed non-leap reference year (2026, 1 Jan = Thursday) so estimates are
// deterministic regardless of when the user looks.
const ESTIMATE_DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ESTIMATE_FIRST_WEEKDAY = 4;

/**
 * Average number of times a cron fires per month, computed exactly over a
 * reference year — the number that matters for "each scan uses 1 AI message"
 * billing copy. May be fractional (sparse schedules) or 0 (a valid cron that
 * never fires, e.g. Feb 30). Null when invalid.
 */
export function estimateScansPerMonth(expression: string): number | null {
  const fields = parseCronExpression(expression);
  if (fields === null) return null;

  const firesPerDay = fields.hour.size * fields.minute.size;
  const domRestricted = !isFullRange(fields.dayOfMonth, FIELD_SPECS[2]);
  const dowRestricted = fields.dayOfWeek.size < 7;

  let total = 0;
  let weekday = ESTIMATE_FIRST_WEEKDAY;
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = ESTIMATE_DAYS_PER_MONTH[month - 1];
    for (let day = 1; day <= daysInMonth; day++) {
      if (fields.month.has(month)) {
        const domMatches = fields.dayOfMonth.has(day);
        const dowMatches = fields.dayOfWeek.has(weekday);
        // Standard cron: when both day-of-month and day-of-week are
        // restricted, the schedule fires when EITHER matches.
        const dayMatches =
          domRestricted && dowRestricted
            ? domMatches || dowMatches
            : domMatches && dowMatches;
        if (dayMatches) total += firesPerDay;
      }
      weekday = (weekday + 1) % 7;
    }
  }
  return total / 12;
}

/******************************************************************************
                      Visual schedule builder <-> cron
******************************************************************************/

export type ScheduleFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface ScheduleBuilderState {
  frequency: ScheduleFrequency;
  /** 24h "HH:MM", straight from an <input type="time"> */
  time: string;
  /** 0 (Sunday) – 6 (Saturday); only meaningful for weekly */
  weekday: number;
  /** 1–28 to exist in every month; only meaningful for monthly */
  monthDay: number;
}

export const DEFAULT_BUILDER_STATE: ScheduleBuilderState = {
  frequency: 'daily',
  time: '08:00',
  weekday: 1,
  monthDay: 1,
};

export function builderToCron(state: ScheduleBuilderState): string {
  const [hour, minute] = state.time.split(':').map(Number);
  switch (state.frequency) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekdays':
      return `${minute} ${hour} * * 1-5`;
    case 'weekly':
      return `${minute} ${hour} * * ${state.weekday}`;
    case 'monthly':
      return `${minute} ${hour} ${state.monthDay} * *`;
  }
}

/**
 * Recover builder state from a cron expression. Returns null for any shape
 * the visual builder can't represent (those fall back to the advanced cron
 * input).
 */
export function cronToBuilder(expression: string): ScheduleBuilderState | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minuteField, hourField, domField, monthField, dowField] = fields;

  if (monthField !== '*') return null;
  if (!/^\d+$/.test(minuteField) || !/^\d+$/.test(hourField)) return null;
  const minute = Number(minuteField);
  const hour = Number(hourField);
  if (minute > 59 || hour > 23) return null;

  const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const base = { ...DEFAULT_BUILDER_STATE, time };

  if (domField === '*') {
    if (dowField === '*') return { ...base, frequency: 'daily' };
    if (dowField === '1-5') return { ...base, frequency: 'weekdays' };
    if (/^\d+$/.test(dowField)) {
      const weekday = Number(dowField);
      if (weekday <= 7) {
        return { ...base, frequency: 'weekly', weekday: weekday === 7 ? 0 : weekday };
      }
    }
    return null;
  }

  if (dowField === '*' && /^\d+$/.test(domField)) {
    const monthDay = Number(domField);
    if (monthDay >= 1 && monthDay <= 28) {
      return { ...base, frequency: 'monthly', monthDay };
    }
  }

  return null;
}
