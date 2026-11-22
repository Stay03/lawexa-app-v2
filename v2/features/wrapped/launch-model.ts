/**
 * The one-time Lawexa Wrapped launch pop-up on the home (Arthur, thread
 * f833c285, 5 November 2026), built like the classic app's ambassador pop-up
 * and the new design's RedesignIntro: a 1200 x 630 picture, the title, one
 * line, and "See your Wrapped".
 *
 * WHO. The same students as the home banner: a Law School profile whose
 * Wrapped exists (`useHasWrapped`), until 31 December.
 *
 * ONCE. The ambassador pop-up keeps its close on the device, so this one does
 * too, keyed by the account id: every way out of it (See your Wrapped,
 * Close, Escape, a tap outside) counts as seen, and it does not come back on this
 * device.
 *
 * NEVER STACKED. It waits while "Welcome to the new Lawexa" has not been seen,
 * so a student meets one pop-up at a time; and, like that pop-up, it never
 * opens over an answer being written or a quiz being played.
 */

export const WRAPPED_LAUNCH_TITLE = 'Your Bar Finals Wrapped is out';
export const WRAPPED_LAUNCH_TEXT = 'Your Bar Finals year on Lawexa, in eight cards, with one made to post on your status.';

/** The pop-up's picture: the /wrapped link preview, 1200 x 630. */
export const WRAPPED_LAUNCH_IMAGE = {
  src: '/wrapped/og.png',
  alt: 'Your Bar Finals Report is out. The Law. The Bar. The Bench.',
} as const;

/** This browser's mark for one account. */
export function wrappedLaunchSeenKey(userId: number): string {
  return `lawexa-wrapped-launch-seen:${userId}`;
}

/**
 * The Wrapped 2026 launch (thread f833c285): Arthur's words and the picture he
 * picked on 21 November 2026 (the kit's wheel, lilac, the casting question).
 * Its own mark, so someone who closed the Bar Finals pop-up still meets this
 * one once.
 */
export const WRAPPED_2026_LAUNCH = {
  title: 'Your 2026 on Lawexa',
  text: 'See the character your year earned you.',
  image: { src: '/wrapped/og-2026.png', alt: 'If your year on Lawexa were a legal drama, who would you play? The Wrapped 2026 wheel of characters.' },
  seenKey: (userId: number) => `lawexa-wrapped-2026-launch-seen:${userId}`,
} as const;

export const WRAPPED_BAR_FINALS_LAUNCH = {
  title: WRAPPED_LAUNCH_TITLE,
  text: WRAPPED_LAUNCH_TEXT,
  image: WRAPPED_LAUNCH_IMAGE,
  seenKey: wrappedLaunchSeenKey,
} as const;

export type WrappedLaunch = typeof WRAPPED_2026_LAUNCH | typeof WRAPPED_BAR_FINALS_LAUNCH;

/** Which launch the home shows: 2026 for someone with a 2026 record, else Bar Finals, else none. */
export function launchFor(has2026: boolean, hasBarFinals: boolean): WrappedLaunch | null {
  if (has2026) return WRAPPED_2026_LAUNCH;
  return hasBarFinals ? WRAPPED_BAR_FINALS_LAUNCH : null;
}

export interface WrappedLaunchInputs {
  /** A Law School student whose Wrapped exists (the banner's rule). */
  hasWrapped: boolean;
  userId: number | null;
  /** This browser's mark for the account. */
  seenHere: boolean;
  /** "Welcome to the new Lawexa" is seen, on the server or here. */
  introSeen: boolean;
  /** Mounted on the client, a beat after the first paint. */
  settled: boolean;
  /** An answer is being written, or a quiz played (screen-hold). */
  screenHeld: boolean;
  /** Already up: a hold that starts under it does not take it down. */
  showing: boolean;
  image: 'loading' | 'ready' | 'failed';
}

export function wrappedLaunchShouldOpen(inputs: WrappedLaunchInputs): boolean {
  const { hasWrapped, userId, seenHere, introSeen, settled, screenHeld, showing, image } = inputs;
  if (!hasWrapped || userId === null || !settled || seenHere || !introSeen) return false;
  // Never a card with a missing picture.
  if (image !== 'ready') return false;
  return showing || !screenHeld;
}
