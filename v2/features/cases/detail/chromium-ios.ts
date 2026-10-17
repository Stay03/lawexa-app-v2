import { useSyncExternalStore } from 'react';

/**
 * Chromium's iPhone browsers and their keyboard accessory (Arthur's iPhone
 * Chrome recordings, 16 October 2026).
 *
 * Chrome (`CriOS`) and Edge (`EdgiOS`) on iPhone run Chromium's iOS shell on
 * WebKit. Two things set them apart from Safari and the home-screen app for
 * the phone case chat:
 *
 * - THEY RESIZE, THEY DO NOT PAN. With the keyboard up, `innerHeight` shrinks
 *   with `visualViewport.height` (337 and 337 in both recordings) and
 *   `offsetTop` stays 0. The Safari hold in `CaseAsk` (held geometry, the
 *   transparent `rising` slot, the scripted fade) exists for Safari's pan, so
 *   on these browsers it is skipped and the card takes the visible area
 *   directly, with no opacity change while the keyboard rises.
 * - THEIR AUTOFILL BAR CAN SIT INSIDE THE VISIBLE AREA. Chromium shows its
 *   form input accessory (the key, card and location bar) on any editable
 *   field, whatever the page's `autocomplete` (form_input_accessory_mediator.mm),
 *   and on iOS 26 draws it as a floating glass bar that can sit above the
 *   keyboard rectangle WebKit subtracts. Recording 1 shows it over the bottom
 *   70 px of the reported area. So while the keyboard is up the composer keeps
 *   {@link CHROMIUM_IOS_ACCESSORY_RESERVE_PX} clear at the card's bottom.
 *
 * Everything else on iOS (Safari, the home-screen app, Firefox) keeps the
 * existing path untouched.
 */
export function isChromiumIOS(userAgent: string): boolean {
  return /\b(?:CriOS|EdgiOS)\//.test(userAgent);
}

/**
 * The room kept under the composer while the keyboard is up in Chrome or Edge
 * on iPhone: Chromium's large keyboard accessory (`kLargeKeyboardAccessoryHeight`,
 * 59 pt, the iOS 26 glass bar) plus the padding around the glass pill
 * (`kSurroundingPadding`, 12 pt), rounded up. Both from
 * ios/chrome/common/ui/elements/form_input_accessory_view.mm and
 * ios/chrome/browser/autofill/form_input_accessory/ui/form_input_accessory_view_controller.mm.
 * The default bar is shorter (`kDefaultAccessoryHeight`, 44 pt), so this covers
 * both.
 */
export const CHROMIUM_IOS_ACCESSORY_RESERVE_PX = 72;

/**
 * How much shorter than the tallest visible height the visible area has to be
 * before the keyboard counts as up. A phone keyboard takes well over 200 px;
 * Safari's toolbars moving take far less.
 */
export const KEYBOARD_UP_MIN_PX = 150;

/** The keyboard is up: the visible area is well below its tallest at this width. */
export function keyboardIsUp(height: number, fullHeight: number): boolean {
  return fullHeight - height > KEYBOARD_UP_MIN_PX;
}

const noSubscribe = (): (() => void) => () => {};

/** Whether this browser is Chrome or Edge on iPhone. False on the server and
 *  while hydrating, so the server's markup never disagrees with the client. */
export function useChromiumIOS(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => isChromiumIOS(navigator.userAgent),
    () => false,
  );
}
