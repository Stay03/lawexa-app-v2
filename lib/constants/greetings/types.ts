/******************************************************************************
                                  Types
******************************************************************************/

type TTimePeriod =
  | 'earlyMorning'
  | 'lateMorning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'lateNight';

type TDayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'weekend';

type THoliday =
  | 'christmas'
  | 'newYear'
  | 'halloween'
  | 'thanksgiving'
  | 'valentines'
  | 'easter'
  | 'independenceDay';

interface IGreeting {
  withName: string[];
  withoutName: string[];
}

interface IHolidayConfig {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  greetings: IGreeting;
}

/******************************************************************************
                                  Exports
******************************************************************************/

export type { TTimePeriod, TDayOfWeek, THoliday, IGreeting, IHolidayConfig };
