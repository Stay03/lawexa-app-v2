import type { TDayOfWeek, IGreeting } from './types';

/******************************************************************************
                                  Constants
******************************************************************************/

const DAY_GREETINGS: Record<TDayOfWeek, IGreeting> = {
  monday: {
    withName: [
      'Monday motivation,',
      'Fresh week energy,',
      'Monday Magic,',
      'New week, new goals,',
    ],
    withoutName: [
      'Monday motivation!',
      'Fresh week energy!',
      'Monday Magic!',
      'New week, new goals!',
    ],
  },
  tuesday: {
    withName: [
      'Tuesday productivity,',
      'Building momentum,',
      'Getting things done,',
      'Keep the streak going,',
    ],
    withoutName: [
      'Tuesday productivity!',
      'Building momentum!',
      'Getting things done!',
      'Keep the streak going!',
    ],
  },
  wednesday: {
    withName: [
      'Midweek check in,',
      'Wednesday warrior,',
      'Halfway through the week,',
      'Hump day energy,',
    ],
    withoutName: [
      'Midweek check in!',
      'Wednesday warrior!',
      'Halfway through the week!',
      'Hump day energy!',
    ],
  },
  thursday: {
    withName: [
      'Almost there,',
      'Thursday push,',
      'Weekend is near,',
      'Final stretch,',
    ],
    withoutName: [
      'Almost there!',
      'Thursday push!',
      'Weekend is near!',
      'Final stretch!',
    ],
  },
  friday: {
    withName: [
      'Friday finish strong,',
      'Weekend incoming,',
      'End week right,',
      'TGIF,',
    ],
    withoutName: [
      'Friday finish strong!',
      'Weekend incoming!',
      'End week right!',
      'TGIF!',
    ],
  },
  weekend: {
    withName: [
      'Weekend productivity,',
      'Relaxed work mode,',
      'Weekend warrior,',
      'Weekend vibes,',
    ],
    withoutName: [
      'Weekend productivity!',
      'Relaxed work mode!',
      'Weekend warrior!',
      'Weekend vibes!',
    ],
  },
};

/******************************************************************************
                                  Exports
******************************************************************************/

export { DAY_GREETINGS };
