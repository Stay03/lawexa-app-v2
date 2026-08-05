'use client';

import { useState } from 'react';

/**
 * use-held-value — hold a value through its own exit tween.
 *
 * A collapsing region that renders `null` empties in the first frame and then
 * animates an empty box shut, which reads as a glitch rather than a dismissal.
 * This is React's sanctioned guarded render-adjust (the same idiom
 * `EnablePushNudge` and the composer's reply bar already use), so the last real
 * value survives until a new one replaces it.
 *
 * Values must be referentially stable between sets — every caller sets from an
 * event handler or from server data, never from a render-time literal, so the
 * guard can never loop.
 *
 * IT LIVES HERE, BESIDE `use-minute-now`, rather than inside the composer that
 * first needed it: the feed's matched-nobody hint collapses too, and a feed row
 * reaching into `composer/ChatComposerShell` for four lines would drag a whole
 * client surface into its module graph to borrow a primitive that was never
 * about composing. One idiom, one home (2026-08-05).
 */
export function useHeldValue<T>(value: T | null): T | null {
  const [held, setHeld] = useState<T | null>(value);
  if (value !== null && value !== held) setHeld(value);
  return value ?? held;
}
