import type { IGreeting } from './types';

/******************************************************************************
                                  Constants
******************************************************************************/

const FALLBACK_GREETINGS: IGreeting = {
  withName: [
    'Welcome back,',
    'Good to see you,',
    'Hey there,',
    'Hello,',
  ],
  withoutName: [
    'Welcome back!',
    'Good to see you!',
    'Let\'s get started!',
    'Time to focus!',
  ],
};

/******************************************************************************
                                  Exports
******************************************************************************/

export { FALLBACK_GREETINGS };
