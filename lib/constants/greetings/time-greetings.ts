import type { TTimePeriod, IGreeting } from './types';

/******************************************************************************
                                  Constants
******************************************************************************/

const TIME_GREETINGS: Record<TTimePeriod, IGreeting> = {
  earlyMorning: {
    withName: [
      'Good morning,',
      'Rise and shine,',
      'Morning,',
      'Early bird today,',
    ],
    withoutName: [
      'Good morning!',
      'Rise and shine!',
      'Early bird today!',
      'Morning vibes!',
    ],
  },
  lateMorning: {
    withName: [
      'Productive morning,',
      'Good morning,',
      'Building momentum early,',
      'Almost midday,',
    ],
    withoutName: [
      'Productive morning!',
      'Building momentum early!',
      'Almost midday!',
      'Good morning!',
    ],
  },
  afternoon: {
    withName: [
      'Good afternoon,',
      'Midday productivity,',
      'Afternoon vibes,',
      'Hello,',
    ],
    withoutName: [
      'Good afternoon!',
      'Midday productivity!',
      'Afternoon vibes!',
      'Keep up the momentum!',
    ],
  },
  evening: {
    withName: [
      'Good evening,',
      'Evening Grind,',
      'End day strong,',
      'Evening,',
    ],
    withoutName: [
      'Good evening!',
      'Evening Grind!',
      'End day strong!',
      'Evening session!',
    ],
  },
  night: {
    withName: [
      'Evening,',
      'Night owl,',
      'Night focus mode,',
      'Still at it,',
    ],
    withoutName: [
      'Night owl mode!',
      'Night focus mode!',
      'Burning the midnight oil!',
      'Late night session!',
    ],
  },
  lateNight: {
    withName: [
      'Up late,',
      'Midnight oil burning,',
      'Night warrior,',
      'Still awake,',
    ],
    withoutName: [
      'Up late!',
      'Midnight oil burning!',
      'Night warrior mode!',
      'The night is young!',
    ],
  },
};

/******************************************************************************
                                  Exports
******************************************************************************/

export { TIME_GREETINGS };
