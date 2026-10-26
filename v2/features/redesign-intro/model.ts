/**
 * "Lawexa, redesigned": the one-time pop-up for the switch to the new design
 * (Stay, 25 October 2026, 17:23Z: "pop-up for the v2 switch today").
 *
 * Shown once to a signed-in account, the first time it opens the new design,
 * and never over an answer that is being written or a quiz being played.
 * Every way out of it counts as seen: "Take a look", "Don't show again", the
 * ×, Escape and a tap outside. It does not come back.
 *
 * WHERE "SEEN" LIVES. Per account, so a reader who closes it on a phone does
 * not meet it again on a computer: the account's own user record carries
 * `v2_intro_seen_at` (Backend, 25 October 2026), and closing the pop-up posts
 * `/auth/me/v2-intro-seen`. This browser also keeps its own mark, keyed by the
 * account id, so the close holds at once and on a server that does not have
 * the field yet (a missing key is "not known", never "seen").
 */

export const REDESIGN_INTRO_TITLE = 'Lawexa, redesigned';
export const REDESIGN_INTRO_TEXT =
  'A cleaner chat, drafts that open beside the case you are reading, and your notes and quizzes in one place.';

/** One of the pop-up's pictures, 1200 x 630, in public/. */
export interface IntroImage {
  src: string;
  alt: string;
}

/**
 * The pop-up's pictures, in order. Stay picked three light ones (25 October
 * 2026); the files come from Tester. Empty: the pop-up draws a neutral band
 * of the same shape. Every one is loaded before the pop-up may open
 * (intro-images.ts). How three are shown (a carousel, or one at a time)
 * waits on Stay; until then the band shows the first.
 */
export const REDESIGN_INTRO_IMAGES: readonly IntroImage[] = [];

/** This browser's mark for one account. */
export function introSeenKey(userId: number): string {
  return `lawexa-v2-intro-seen:${userId}`;
}

export interface IntroInputs {
  /** A signed-in account (never a guest pass, never signed out). */
  account: boolean;
  userId: number | null;
  /** The server's mark (`v2_intro_seen_at`), once the field exists. */
  seenOnServer: boolean;
  /** This browser's mark for the account. */
  seenHere: boolean;
  /** Mounted on the client: before that, localStorage cannot be read. */
  mounted: boolean;
  /** An answer is being written, or a quiz played (screen-hold). */
  screenHeld: boolean;
  /** The pop-up is already up: a hold that starts under it does not take it down. */
  showing: boolean;
  /** Its pictures: every one loaded, still loading, or one failed. */
  images: 'loading' | 'ready' | 'failed';
}

export function introShouldOpen(inputs: IntroInputs): boolean {
  const { account, userId, seenOnServer, seenHere, mounted, screenHeld, showing, images } = inputs;
  if (!account || userId === null || !mounted) return false;
  if (seenOnServer || seenHere) return false;
  // Never a card with a missing picture: it opens only once all have loaded.
  if (images !== 'ready') return false;
  return showing || !screenHeld;
}
