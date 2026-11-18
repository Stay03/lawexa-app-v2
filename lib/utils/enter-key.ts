/**
 * What Enter does in a box people type messages into: ONE rule for every chat
 * box in the app (Arthur, 18 November 2026, thread 8282ffe7: "Enter sends the
 * message in some chat boxes and not in others").
 *
 * - On a device with a real keyboard, Enter sends; Shift+Enter starts a new
 *   line. Cmd or Ctrl+Enter sends too, as a plain Enter does.
 * - On a touch-only device (a phone, a tablet without a keyboard), the
 *   keyboard's return key starts a new line and the send button sends.
 * - The window's width plays no part. A laptop with a narrow browser window
 *   still has a keyboard; it used to get new lines in some boxes.
 * - Enter while a word is still being composed (IME: Chinese, Japanese and
 *   Korean input, and predictive keyboards) finishes the word and never sends
 *   a half-typed message.
 *
 * "Touch-only" is read at the moment of the key press, with the same media
 * query the channel composer used: `(hover: none)`. No device reports hover
 * when its only pointer is a finger.
 */

export type EnterOutcome =
  /** Not Enter, or Enter confirming a composition: leave it to the box. */
  | 'ignore'
  /** Enter that should start a new line: let the textarea do it. */
  | 'newline'
  /** Enter that should send: prevent the new line and send. */
  | 'send';

export interface EnterKeyLike {
  key: string;
  shiftKey: boolean;
  /** `event.nativeEvent.isComposing`. */
  isComposing: boolean;
  /** `event.keyCode`; 229 is "a composition is in progress" on older Safari and some Android keyboards. */
  keyCode?: number;
}

/**
 * Whether a touch-only device's return key sends too, making phone and
 * computer behave the same (Stay asked Arthur, 18 November 2026, thread
 * 8282ffe7). False: return adds a line on a phone. The one switch for it.
 */
export const TOUCH_ONLY_ENTER_SENDS = false;

/** The rule itself, with the device passed in, so it is tested without a browser. */
export function enterOutcome(
  event: EnterKeyLike,
  touchOnly: boolean,
  touchOnlySends: boolean = TOUCH_ONLY_ENTER_SENDS,
): EnterOutcome {
  if (event.key !== 'Enter') return 'ignore';
  if (event.isComposing || event.keyCode === 229) return 'ignore';
  if (event.shiftKey) return 'newline';
  return touchOnly && !touchOnlySends ? 'newline' : 'send';
}

/** Whether the device has no keyboard-and-pointer to speak of, read now. */
export function isTouchOnlyDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: none)').matches;
}

/**
 * For a React keydown handler: true when this Enter should send. It has
 * already prevented the textarea's new line, so the caller only sends.
 *
 *   if (sendsOnEnter(event)) submit();
 */
export function sendsOnEnter(event: {
  key: string;
  shiftKey: boolean;
  keyCode?: number;
  nativeEvent: { isComposing: boolean };
  preventDefault: () => void;
}): boolean {
  const outcome = enterOutcome(
    { key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing, keyCode: event.keyCode },
    isTouchOnlyDevice(),
  );
  if (outcome !== 'send') return false;
  event.preventDefault();
  return true;
}
