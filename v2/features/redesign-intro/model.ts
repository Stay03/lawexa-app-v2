/**
 * "Lawexa, redesigned": the one-time pop-up for the switch to the new design
 * (Stay, 25 October 2026, 17:23Z: "pop-up for the v2 switch today").
 *
 * Shown once to a signed-in account, the first time it opens the new design,
 * and never over an answer that is being written or a quiz being played.
 * Every way out of it counts as seen: "Take a look", the ×, Escape and a tap
 * outside. It does not come back.
 *
 * WHERE "SEEN" LIVES. Per account, so a reader who closes it on a phone does
 * not meet it again on a computer: the account's own user record carries
 * `v2_intro_seen_at` (Backend, 25 October 2026), and closing the pop-up posts
 * `/auth/me/v2-intro-seen`. This browser also keeps its own mark, keyed by the
 * account id, so the close holds at once and on a server that does not have
 * the field yet (a missing key is "not known", never "seen").
 */

// Stay, 26 October 2026 (00:25 UTC): the text as the techlead wrote it. The
// pictures already say "Lawexa, redesigned.", so the title does not repeat it.
export const REDESIGN_INTRO_TITLE = 'Welcome to the new Lawexa';
export const REDESIGN_INTRO_TEXT = 'A cleaner look, with your chats, cases, notes and work in one place.';

/** One of the pop-up's pictures, 1200 x 630, in public/. */
export interface IntroImage {
  src: string;
  alt: string;
}

/**
 * The pop-up's pictures, in order, light only (Stay, 25 October 2026: pictures
 * 2, 3 and 6). WebP files in public/v2-intro/, made from Tester's PNGs. They
 * slide one after another, with dots under them (Stay picked A, 26 October
 * 2026). Every one is loaded before the pop-up may open (intro-images.ts).
 * Empty: a neutral band of the same shape.
 *
 * Picture 6 (the draft beside the case) is Tester's retake with the calmer
 * Save button (app 9386975a, 26 October 2026).
 */
export const REDESIGN_INTRO_IMAGES: readonly IntroImage[] = [
  { src: '/v2-intro/redesigned-case.webp', alt: 'A case on a phone and a computer in the new design' },
  { src: '/v2-intro/redesigned-statute.webp', alt: 'A statute with its contents on a phone and a computer in the new design' },
  { src: '/v2-intro/redesigned-draft.webp', alt: 'A letter drafted beside a case on a phone and a computer in the new design' },
];

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
