import type { TTimePeriod, TDayOfWeek, THoliday, IGreeting } from './types';
import { TIME_GREETINGS } from './time-greetings';
import { DAY_GREETINGS } from './day-greetings';
import { HOLIDAY_CONFIGS } from './holiday-greetings';
import { FALLBACK_GREETINGS } from './fallback-greetings';

/******************************************************************************
                                  Functions
******************************************************************************/

/** Get the current time period based on hour of day. */
function getTimePeriod(): TTimePeriod {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return 'earlyMorning';
  if (hour >= 9 && hour < 12) return 'lateMorning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  if (hour >= 21 && hour < 24) return 'night';
  return 'lateNight';
}

/** Get the current day of week category. */
function getDayOfWeek(): TDayOfWeek {
  const day = new Date().getDay();
  // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return 'weekend';
  if (day === 1) return 'monday';
  if (day === 2) return 'tuesday';
  if (day === 3) return 'wednesday';
  if (day === 4) return 'thursday';
  return 'friday';
}

/** Check if today falls within a holiday range. */
function getActiveHoliday(): THoliday | null {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const holidays = Object.entries(HOLIDAY_CONFIGS) as [THoliday, typeof HOLIDAY_CONFIGS[THoliday]][];
  for (const [holiday, config] of holidays) {
    // Handle year-boundary holidays (e.g., New Year: Dec 31 - Jan 2)
    if (config.startMonth > config.endMonth) {
      // Holiday spans year boundary
      if (
        (month === config.startMonth && day >= config.startDay) ||
        (month === config.endMonth && day <= config.endDay)
      ) {
        return holiday;
      }
    } else {
      // Normal date range within same year
      const isAfterStart = month > config.startMonth || (month === config.startMonth && day >= config.startDay);
      const isBeforeEnd = month < config.endMonth || (month === config.endMonth && day <= config.endDay);
      if (isAfterStart && isBeforeEnd) {
        return holiday;
      }
    }
  }
  return null;
}

/** Select a random message from an array. */
function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

/** Format a greeting with or without the user's name. */
function formatGreeting(greeting: IGreeting, userName?: string | null): string {
  if (userName) {
    const message = getRandomMessage(greeting.withName);
    return `${message} ${userName}!`;
  }
  return getRandomMessage(greeting.withoutName);
}

/**
 * Get a smart greeting based on priority:
 * 1. Holidays (highest priority)
 * 2. Time-based (75% chance) or Day-based (25% chance)
 * 3. Fallback
 */
function getSmartGreeting(userName?: string | null): string {
  // 1. Check for active holiday (highest priority)
  const holiday = getActiveHoliday();
  if (holiday) {
    return formatGreeting(HOLIDAY_CONFIGS[holiday].greetings, userName);
  }
  // 2. Weighted random: 75% time-based, 25% day-based
  const useTimeBased = Math.random() < 0.75;
  if (useTimeBased) {
    const period = getTimePeriod();
    return formatGreeting(TIME_GREETINGS[period], userName);
  }
  const day = getDayOfWeek();
  return formatGreeting(DAY_GREETINGS[day], userName);
}

/**
 * Get greeting parts separately for custom styling.
 * Returns the greeting text and the user's first name.
 */
function getSmartGreetingParts(userName?: string | null): { greeting: string; name: string } {
  const firstName = userName?.split(' ')[0] || '';
  // 1. Check for active holiday
  const holiday = getActiveHoliday();
  if (holiday) {
    const greetings = HOLIDAY_CONFIGS[holiday].greetings;
    const message = firstName
      ? getRandomMessage(greetings.withName)
      : getRandomMessage(greetings.withoutName);
    return { greeting: message.replace(/,$/, ''), name: firstName };
  }
  // 2. Weighted random: 75% time-based, 25% day-based
  const useTimeBased = Math.random() < 0.75;
  if (useTimeBased) {
    const period = getTimePeriod();
    const greetings = TIME_GREETINGS[period];
    const message = firstName
      ? getRandomMessage(greetings.withName)
      : getRandomMessage(greetings.withoutName);
    return { greeting: message.replace(/,$/, ''), name: firstName };
  }
  const day = getDayOfWeek();
  const greetings = DAY_GREETINGS[day];
  const message = firstName
    ? getRandomMessage(greetings.withName)
    : getRandomMessage(greetings.withoutName);
  return { greeting: message.replace(/,$/, ''), name: firstName };
}

/******************************************************************************
                                  Exports
******************************************************************************/

export {
  getSmartGreeting,
  getSmartGreetingParts,
  getTimePeriod,
  getDayOfWeek,
  getActiveHoliday,
  TIME_GREETINGS,
  DAY_GREETINGS,
  HOLIDAY_CONFIGS,
  FALLBACK_GREETINGS,
};

export type { TTimePeriod, TDayOfWeek, THoliday, IGreeting } from './types';
