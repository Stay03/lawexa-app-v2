import { test } from 'node:test';
import assert from 'node:assert/strict';

import { visibleTop } from './use-keyboard-inset';

/* Where the phone case chat's top sits (12 October 2026). The chat is fixed to the
 * visible rectangle: while the iOS keyboard is up, iOS pans the page and the chat
 * must follow the pan; once the keyboard is down, the top is 0.
 *
 * The numbers are an iPhone 14 in points: 844 tall with no keyboard, 508 visible
 * with the keyboard up, iOS panning the page by up to 336.
 *
 * The first clamp (6023bb9) used innerHeight as the limit. In Safari innerHeight
 * holds at 844 with the keyboard up, and the clamp was right. In the home-screen app
 * innerHeight shrank to 508 with the keyboard, the limit became 0, and the chat sat
 * 336 points above the screen with only its composer showing (Arthur's IMG_4108).
 * The limit is now the tallest visible height at this width, which is 844 in both. */
const FULL = 844;
const WITH_KEYBOARD = 508;

test('keyboard up and the page panned: the chat follows the pan', () => {
  assert.equal(visibleTop(336, WITH_KEYBOARD, FULL), 336);
  assert.equal(visibleTop(120, WITH_KEYBOARD, FULL), 120);
});

test('keyboard up, not panned yet: top 0', () => {
  assert.equal(visibleTop(0, WITH_KEYBOARD, FULL), 0);
});

test('keyboard down with a stale pan left in offsetTop: top 0, so the chat covers the page bar', () => {
  assert.equal(visibleTop(336, FULL, FULL), 0);
});

test('a pan larger than the keyboard is clamped to the keyboard', () => {
  assert.equal(visibleTop(400, WITH_KEYBOARD, FULL), FULL - WITH_KEYBOARD);
});

test('rubber-band overscroll never gives a negative top', () => {
  assert.equal(visibleTop(-12, WITH_KEYBOARD, FULL), 0);
});

test('the old innerHeight limit is what broke the home-screen app', () => {
  // innerHeight shrank with the keyboard there, so the old limit was 508 - 508 = 0.
  const homeScreenInnerHeight = WITH_KEYBOARD;
  const oldTop = Math.max(0, Math.min(336, homeScreenInnerHeight - WITH_KEYBOARD));
  assert.equal(oldTop, 0, 'the old clamp threw the pan away');
  assert.equal(visibleTop(336, WITH_KEYBOARD, FULL), 336, 'the new one keeps it');
});
