import type { THoliday, IHolidayConfig } from './types';

/******************************************************************************
                                  Constants
******************************************************************************/

const HOLIDAY_CONFIGS: Record<THoliday, IHolidayConfig> = {
  christmas: {
    startMonth: 12,
    startDay: 20,
    endMonth: 12,
    endDay: 26,
    greetings: {
      withName: [
        'Merry Christmas,',
        'Holiday spirit,',
        'Christmas cheer,',
        'Season\'s greetings,',
      ],
      withoutName: [
        'Merry Christmas!',
        'Holiday spirit!',
        'Christmas cheer!',
        'Season\'s greetings!',
      ],
    },
  },
  newYear: {
    startMonth: 12,
    startDay: 31,
    endMonth: 1,
    endDay: 2,
    greetings: {
      withName: [
        'Happy New Year,',
        'Fresh start vibes,',
        'New beginnings,',
        'Cheers to the new year,',
      ],
      withoutName: [
        'Happy New Year!',
        'Fresh start vibes!',
        'New beginnings!',
        'Cheers to the new year!',
      ],
    },
  },
  halloween: {
    startMonth: 10,
    startDay: 29,
    endMonth: 10,
    endDay: 31,
    greetings: {
      withName: [
        'Happy Halloween,',
        'Spooky season,',
        'Trick or treat,',
        'Boo,',
      ],
      withoutName: [
        'Happy Halloween!',
        'Spooky season!',
        'Trick or treat!',
        'Boo!',
      ],
    },
  },
  thanksgiving: {
    startMonth: 11,
    startDay: 22,
    endMonth: 11,
    endDay: 28,
    greetings: {
      withName: [
        'Happy Thanksgiving,',
        'Grateful today,',
        'Blessed day,',
        'Thankful for you,',
      ],
      withoutName: [
        'Happy Thanksgiving!',
        'Grateful today!',
        'Blessed day!',
        'Giving thanks!',
      ],
    },
  },
  valentines: {
    startMonth: 2,
    startDay: 14,
    endMonth: 2,
    endDay: 14,
    greetings: {
      withName: [
        'Happy Valentine\'s Day,',
        'Love is everywhere,',
        'Spread the love,',
        'Valentine vibes,',
      ],
      withoutName: [
        'Happy Valentine\'s Day!',
        'Love is everywhere!',
        'Spread the love!',
        'Valentine vibes!',
      ],
    },
  },
  easter: {
    startMonth: 4,
    startDay: 1,
    endMonth: 4,
    endDay: 15,
    greetings: {
      withName: [
        'Happy Easter,',
        'Spring celebration,',
        'Easter joy,',
        'Spring blessings,',
      ],
      withoutName: [
        'Happy Easter!',
        'Spring celebration!',
        'Easter joy!',
        'Spring blessings!',
      ],
    },
  },
  independenceDay: {
    startMonth: 7,
    startDay: 4,
    endMonth: 7,
    endDay: 4,
    greetings: {
      withName: [
        'Happy July 4th,',
        'Freedom celebration,',
        'Independence Day,',
        'Happy 4th,',
      ],
      withoutName: [
        'Happy July 4th!',
        'Freedom celebration!',
        'Independence Day!',
        'Happy 4th!',
      ],
    },
  },
};

/******************************************************************************
                                  Exports
******************************************************************************/

export { HOLIDAY_CONFIGS };
