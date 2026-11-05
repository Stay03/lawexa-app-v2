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
 * too, keyed by the account id: every way out of it (the button, the ×,
 * Escape, a tap outside) counts as seen, and it does not come back on this
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
