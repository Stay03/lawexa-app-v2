import { WRAPPED26_SLIDE_IDS, type Wrapped26SlideId, type Wrapped26Track } from './types';

/**
 * The 2026 story's rules, with no React, so a test pins each one (the kit's
 * BUILD_SPEC §3–4 and MOTION_SPEC). The player lays the slides out and runs
 * their animations; everything about WHEN lives here.
 */

export type Wrapped26Theme = 'ink' | 'paper';

/** How a slide comes in. Back taps are always a push, reversed. */
export type Wrapped26Transition = 'wipe' | 'push' | 'spotlight';

export interface Wrapped26SlideSpec {
  /** The progress segment, 1 to 10; 0 for the intro, which shows no chrome. */
  step: number;
  /** How long the slide plays before the next; 0 waits for its own control. */
  duration: number;
  transition: Wrapped26Transition;
  theme: Record<Wrapped26Track, Wrapped26Theme>;
}

const both = (theme: Wrapped26Theme): Record<Wrapped26Track, Wrapped26Theme> => ({ undergraduates: theme, lawyers: theme });
/** Students on `theme`, lawyers on the other (the kit's Lawyers screens flip 02a to 08). */
const flip = (theme: Wrapped26Theme): Record<Wrapped26Track, Wrapped26Theme> => ({ undergraduates: theme, lawyers: theme === 'ink' ? 'paper' : 'ink' });

export const WRAPPED26_SLIDES: Record<Wrapped26SlideId, Wrapped26SlideSpec> = {
  '00': { step: 0, duration: 0, transition: 'push', theme: both('ink') },
  '01': { step: 1, duration: 5200, transition: 'wipe', theme: both('ink') },
  '02a': { step: 2, duration: 0, transition: 'wipe', theme: flip('paper') },
  '02b': { step: 2, duration: 5200, transition: 'push', theme: flip('paper') },
  '03': { step: 3, duration: 5600, transition: 'wipe', theme: flip('ink') },
  '04': { step: 4, duration: 5600, transition: 'wipe', theme: flip('paper') },
  '05': { step: 5, duration: 5600, transition: 'wipe', theme: flip('ink') },
  '06': { step: 6, duration: 5600, transition: 'wipe', theme: flip('paper') },
  '07': { step: 7, duration: 6000, transition: 'wipe', theme: flip('ink') },
  '08': { step: 8, duration: 5600, transition: 'wipe', theme: flip('paper') },
  '09a': { step: 9, duration: 6000, transition: 'wipe', theme: both('ink') },
  // 09b spins and 09c is its locked-in state: one slide on screen, 7.6 s.
  '09b': { step: 9, duration: 7600, transition: 'push', theme: both('ink') },
  '09c': { step: 9, duration: 0, transition: 'push', theme: both('ink') },
  '09d': { step: 9, duration: 7600, transition: 'spotlight', theme: both('ink') },
  '10': { step: 10, duration: 0, transition: 'wipe', theme: both('paper') },
};

/** A press held longer than this pauses; shorter, it is a tap. */
export const HOLD_MS = 220;

/** The left share of the stage that goes back. */
export const BACK_ZONE = 0.3;

/**
 * The slides the player shows, from the server's list. 09c is not a slide of
 * its own on screen: it is how 09b ends (the wheel stops and locks in), so it
 * folds into 09b. Unknown ids are dropped rather than shown blank.
 */
export function slidesToPlay(slides: readonly string[]): Wrapped26SlideId[] {
  const known = new Set<string>(WRAPPED26_SLIDE_IDS);
  return slides.filter((id): id is Wrapped26SlideId => known.has(id) && id !== '09c');
}

/**
 * The progress-event number of a slide: its place in the kit's full order,
 * 00 = 1 to 10 = 15, so a skipped slide never shifts another's number (agreed
 * with Backend, 21 November 2026).
 */
export function cardNumber(id: Wrapped26SlideId): number {
  return WRAPPED26_SLIDE_IDS.indexOf(id) + 1;
}

/** The ten segments' fill, 0 to 1. Slides that share a step fill its segment in turn. */
export function segmentFill(slides: readonly Wrapped26SlideId[], index: number, elapsed: number): number[] {
  const current = slides[index];
  const spec = current ? WRAPPED26_SLIDES[current] : null;
  return Array.from({ length: 10 }, (_, i) => {
    const step = i + 1;
    if (!spec || spec.step === 0) return 0;
    if (step < spec.step) return 1;
    if (step > spec.step) return 0;
    const same = slides.filter((id) => WRAPPED26_SLIDES[id].step === step);
    const position = same.indexOf(current);
    const local = spec.duration > 0 ? Math.min(1, elapsed / spec.duration) : 0;
    return same.length > 0 ? (position + local) / same.length : 0;
  });
}

export interface Wrapped26StoryState {
  index: number;
  /** How long the current slide has played, in ms. */
  elapsed: number;
  paused: boolean;
  /** A slide is coming in: taps wait (one step is kept, never dropped). */
  moving: boolean;
  queued: 'next' | 'back' | null;
  /** Which way the current slide came in, for the transition. */
  direction: 1 | -1;
  /** The slide going out while `moving`, drawn under the one coming in. */
  from: number | null;
}

export type Wrapped26StoryAction =
  | { type: 'tick'; ms: number }
  /** A tap on the right of the stage. */
  | { type: 'tap-next' }
  | { type: 'back' }
  /** A slide's own control: Start, a guess, the wheel's "meet your character". */
  | { type: 'advance' }
  | { type: 'settled' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'toggle' };

export function initialStory(index = 0): Wrapped26StoryState {
  return { index, elapsed: 0, paused: false, moving: false, queued: null, direction: 1, from: null };
}

/** A slide that waits for its own control ignores a tap on the right (BUILD_SPEC §4). */
export function waitsForControl(id: Wrapped26SlideId | undefined): boolean {
  return id === '00' || id === '02a' || id === '10';
}

function move(state: Wrapped26StoryState, last: number, direction: 1 | -1): Wrapped26StoryState {
  const index = state.index + direction;
  if (index < 0 || index > last) return { ...state, queued: null };
  return { ...state, index, elapsed: 0, moving: true, queued: null, direction, from: state.index };
}

export function storyReducer(slides: readonly Wrapped26SlideId[], state: Wrapped26StoryState, action: Wrapped26StoryAction): Wrapped26StoryState {
  const last = slides.length - 1;
  const current = slides[state.index];
  switch (action.type) {
    case 'tick': {
      if (state.paused || state.moving || !current) return state;
      const { duration } = WRAPPED26_SLIDES[current];
      if (duration === 0) return state;
      const elapsed = state.elapsed + Math.max(0, action.ms);
      if (elapsed < duration) return { ...state, elapsed };
      return state.index < last ? move(state, last, 1) : { ...state, elapsed: duration };
    }
    case 'tap-next':
      if (state.moving) return { ...state, queued: 'next' };
      return waitsForControl(current) ? state : move(state, last, 1);
    case 'advance':
      if (state.moving) return { ...state, queued: 'next' };
      return move(state, last, 1);
    case 'back':
      if (state.moving) return { ...state, queued: 'back' };
      return state.index > 0 ? move(state, last, -1) : { ...state, elapsed: 0 };
    case 'settled': {
      const settled = { ...state, moving: false, queued: null, from: null };
      if (state.queued === 'next' && !waitsForControl(slides[state.index])) return move(settled, last, 1);
      if (state.queued === 'back') return state.index > 0 ? move(settled, last, -1) : settled;
      return settled;
    }
    case 'pause':
      return state.paused ? state : { ...state, paused: true };
    case 'resume':
      return state.paused ? { ...state, paused: false } : state;
    case 'toggle':
      return { ...state, paused: !state.paused };
  }
}

/** Where a tap landed, as a share of the stage's width. */
export function tapSide(x: number, width: number): 'back' | 'next' {
  return width > 0 && x / width < BACK_ZONE ? 'back' : 'next';
}

/** The stage's scale: the 1080×1920 canvas fitted inside the viewport (letterboxed). */
export function stageScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(width / 1080, height / 1920);
}
