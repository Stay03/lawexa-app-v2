type TimePeriod = 'earlyMorning' | 'lateMorning' | 'afternoon' | 'evening' | 'night' | 'lateNight';

const timeBasedMessages: Record<TimePeriod, { withName: string[]; withoutName: string[] }> = {
  earlyMorning: {
    withName: ['Good morning,', 'Rise and shine,', 'Morning,'],
    withoutName: ['Rise and shine!', 'Good morning!', 'Early bird gets the worm!'],
  },
  lateMorning: {
    withName: ['Good morning,', 'Hey,', 'Hello,'],
    withoutName: ['Good morning!', 'Hello there!', 'Having a productive morning?'],
  },
  afternoon: {
    withName: ['Good afternoon,', 'Hey,', 'Hello,'],
    withoutName: ['Good afternoon!', 'Hope your day is going well!', 'Afternoon grind!'],
  },
  evening: {
    withName: ['Good evening,', 'Hey,', 'Evening,'],
    withoutName: ['Good evening!', 'Winding down?', 'Evening session!'],
  },
  night: {
    withName: ['Hey,', 'Still at it,', 'Night owl,'],
    withoutName: ['Night owl mode!', 'Burning the midnight oil!', 'Late night session!'],
  },
  lateNight: {
    withName: ['Hey,', 'Still awake,', 'Midnight oil burning,'],
    withoutName: ['Midnight oil burning!', 'The night is young!', 'Dedication!'],
  },
};

function getTimePeriod(): TimePeriod {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 9) return 'earlyMorning';
  if (hour >= 9 && hour < 12) return 'lateMorning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  if (hour >= 21 && hour < 24) return 'night';
  return 'lateNight';
}

function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

export function getTimeBasedGreeting(userName?: string | null): string {
  const period = getTimePeriod();
  const messages = timeBasedMessages[period];

  if (userName) {
    const greeting = getRandomMessage(messages.withName);
    return `${greeting} ${userName}!`;
  }

  return getRandomMessage(messages.withoutName);
}
