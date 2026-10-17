import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHROMIUM_IOS_ACCESSORY_RESERVE_PX,
  KEYBOARD_UP_MIN_PX,
  isChromiumIOS,
  keyboardIsUp,
} from './chromium-ios';

/* Chrome and Edge on iPhone take their own path in the phone case chat;
 * Safari, the home-screen app and every other browser keep today's (Arthur's
 * iPhone Chrome recordings, 16 October 2026; the techlead's scope, 17 October). */

const here = dirname(fileURLToPath(import.meta.url));
const ask = readFileSync(join(here, 'CaseAsk.tsx'), 'utf8').replace(/\r\n/g, '\n');

const UA = {
  chromeIPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1',
  edgeIPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 EdgiOS/141.0.3537.57 Mobile/15E148 Safari/605.1.15',
  safariIPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  homeScreenApp:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  firefoxIPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  chromeDesktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};

test('Chrome and Edge on iPhone take the Chromium path; nothing else does', () => {
  assert.equal(isChromiumIOS(UA.chromeIPhone), true);
  assert.equal(isChromiumIOS(UA.edgeIPhone), true);
  for (const name of ['safariIPhone', 'homeScreenApp', 'firefoxIPhone', 'chromeAndroid', 'chromeDesktop'] as const) {
    assert.equal(isChromiumIOS(UA[name]), false, name);
  }
});

test('the keyboard counts as up only well below the tallest visible height', () => {
  // Both recordings: 666 with the keyboard down, 337 with it up.
  assert.equal(keyboardIsUp(337, 666), true);
  assert.equal(keyboardIsUp(666, 666), false);
  // Safari's toolbars moving are far less than a keyboard.
  assert.equal(keyboardIsUp(666 - KEYBOARD_UP_MIN_PX, 666), false);
  assert.equal(keyboardIsUp(666 - KEYBOARD_UP_MIN_PX - 1, 666), true);
});

test('the reserve is one named constant: Chromium\'s large bar plus its padding, rounded up', () => {
  assert.equal(CHROMIUM_IOS_ACCESSORY_RESERVE_PX, 72);
  assert.ok(CHROMIUM_IOS_ACCESSORY_RESERVE_PX >= 59 + 12);
  const source = readFileSync(join(here, 'chromium-ios.ts'), 'utf8');
  for (const constant of ['kLargeKeyboardAccessoryHeight', 'kSurroundingPadding', 'kDefaultAccessoryHeight']) {
    assert.match(source, new RegExp(constant), constant);
  }
});

test('Safari and the home-screen app keep exactly today\'s hold, rising slot and fade', () => {
  // The hold runs for every browser but Chromium's iPhone shell.
  assert.match(ask, /if \(!screenOpen \|\| !card \|\| chromiumIOS\) return;\n {4}const viewport = window\.visualViewport;\n {4}const published =/);
  assert.match(ask, /\}, \[screenOpen, chromiumIOS\]\);\n\n {2}\/\/ ROOM FOR CHROMIUM'S AUTOFILL BAR/);
  // Today's slot classes, character for character, on the non-Chromium branch.
  assert.match(
    ask,
    /: 'flex min-h-0 flex-1 flex-col transition-opacity duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 motion-reduce:transition-none in-data-\[keyboard\]:pointer-events-none in-data-\[keyboard=rising\]:opacity-0 in-data-\[keyboard=riding\]:transition-none'/,
  );
  // The Chromium branch has no transparency and no fade.
  assert.match(ask, /chromiumIOS\s*\?[\s\S]{0,260}'flex min-h-0 flex-1 flex-col'\s*:/);
  // The hold's own body is unchanged: it still holds, rises, rides and fades.
  for (const piece of [
    "card.setAttribute('data-keyboard', 'rising')",
    "card.setAttribute('data-keyboard', 'riding')",
    'slot.animate([{ opacity: 0 }, { opacity: 1 }]',
    'KEYBOARD_RISE_MS',
    'KEYBOARD_SETTLE_CAP_MS',
  ]) {
    assert.ok(ask.includes(piece), piece);
  }
});

test('the reserve applies only in Chrome or Edge on iPhone, only while the keyboard is up', () => {
  const effect = ask.slice(ask.indexOf("// ROOM FOR CHROMIUM'S AUTOFILL BAR"));
  const body = effect.slice(0, effect.indexOf('}, [screenOpen, chromiumIOS]);'));
  assert.match(body, /if \(!screenOpen \|\| !card \|\| !chromiumIOS \|\| !viewport\) return;/);
  assert.match(body, /if \(keyboardIsUp\(viewport\.height, fullHeight\)\) \{\s*card\.style\.setProperty\('padding-bottom', `\$\{CHROMIUM_IOS_ACCESSORY_RESERVE_PX\}px`\);/);
  // Keyboard down, and on close: the property is removed, never set to 0, so
  // the card is exactly as before.
  assert.equal(body.match(/card\.style\.removeProperty\('padding-bottom'\)/g)?.length, 2);
  assert.doesNotMatch(body, /padding-bottom', '0/);
});

test('the kbdebug overlay shows where each part paints and which hold states ran', () => {
  const readout = readFileSync(join(here, 'KeyboardDebugReadout.tsx'), 'utf8');
  // Outlines, not borders, so the overlay moves nothing it measures.
  assert.match(readout, /\$\{CARD\} > :first-child > :first-child \{ outline: 2px solid #84cc16;/);
  assert.match(readout, /\$\{CARD\} > :first-child \{ outline: 2px solid #d946ef;/);
  assert.match(readout, /\$\{CARD\} > :last-child \{ outline: 2px solid #06b6d4;/);
  assert.doesNotMatch(readout, /border: 2px/);
  for (const line of ['`ua ', '`card opacity ', '`reserve ', '`slot ${rectOf(slot)}`', '`composer ${rectOf(composer)}`', '`holds ']) {
    assert.ok(readout.includes(line), line);
  }
  assert.match(readout, /attributeFilter: \['data-keyboard'\]/);
});
