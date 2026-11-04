import type { WrappedSlideNumber } from './types';

/**
 * The story viewer's rules, with no React, so a test pins each one (Arthur's
 * spec: full screen, tap right for next, tap left for back, hold to pause, a
 * progress bar across the top). A frame plays for {@link FRAME_MS}; the last
 * frame, the share card, waits for the student and never moves on by itself.
 */

/** How long one frame plays before the next. */
export const FRAME_MS = 7000;

/** A press held longer than this is a pause, not a tap. */
export const HOLD_MS = 220;

/** The left share of the screen that goes back; the rest goes forward. */
export const BACK_ZONE = 0.3;

export interface StoryState {
  /** The position in `slides`, not the frame number. */
  index: number;
  /** How far the current frame has played, in ms. */
  elapsed: number;
  paused: boolean;
  /** The student reached the end of the last frame. */
  done: boolean;
}

export type StoryAction =
  | { type: 'tick'; ms: number }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'go'; index: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'toggle' };

export function initialStory(): StoryState {
  return { index: 0, elapsed: 0, paused: false, done: false };
}

export function storyReducer(count: number, state: StoryState, action: StoryAction): StoryState {
  const last = Math.max(0, count - 1);
  switch (action.type) {
    case 'tick': {
      if (state.paused || state.done || count === 0) return state;
      const elapsed = state.elapsed + Math.max(0, action.ms);
      if (elapsed < FRAME_MS) return { ...state, elapsed };
      // The share card holds: it is where the student acts.
      if (state.index >= last) return { ...state, elapsed: FRAME_MS, done: true };
      return { ...state, index: state.index + 1, elapsed: 0 };
    }
    case 'next':
      if (state.index >= last) return { ...state, elapsed: FRAME_MS, done: true };
      return { ...state, index: state.index + 1, elapsed: 0, done: false };
    case 'back':
      // Back on the first frame starts it again.
      return { ...state, index: Math.max(0, state.index - 1), elapsed: 0, done: false };
    case 'go':
      return { ...state, index: Math.min(last, Math.max(0, action.index)), elapsed: 0, done: false };
    case 'pause':
      return state.paused ? state : { ...state, paused: true };
    case 'resume':
      return state.paused ? { ...state, paused: false } : state;
    case 'toggle':
      return { ...state, paused: !state.paused };
  }
}

/** Each segment of the progress bar, 0 to 1. */
export function progressOf(count: number, state: StoryState): number[] {
  return Array.from({ length: count }, (_, i) =>
    i < state.index ? 1 : i > state.index ? 0 : Math.min(1, state.elapsed / FRAME_MS),
  );
}

/** Where a tap landed: a share of the width under {@link BACK_ZONE} goes back. */
export function tapSide(x: number, width: number): 'back' | 'next' {
  return width > 0 && x / width < BACK_ZONE ? 'back' : 'next';
}

/** The frames to play: the server's list, kept in story order and unique, with the share card always last. */
export function framesToPlay(slides: readonly number[]): WrappedSlideNumber[] {
  const known = new Set<WrappedSlideNumber>();
  for (const slide of slides) {
    if (Number.isInteger(slide) && slide >= 1 && slide <= 8) known.add(slide as WrappedSlideNumber);
  }
  known.add(8);
  return [...known].sort((a, b) => a - b);
}
