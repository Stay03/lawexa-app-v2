import { test } from 'node:test';
import assert from 'node:assert/strict';

import { syncKeyboardInset } from './use-keyboard-inset';

/* The keyboard inset is read again when the window resizes (17 October 2026).
 *
 * The shell is `100dvh` minus `--keyboard-inset`. Chrome and Edge on iPhone
 * resize the page for the keyboard, so the inset must end at 0 there. They can
 * report the visual viewport's keyboard-up height while `innerHeight` still holds
 * the full one; read at that moment the inset is the keyboard's height, and with
 * no later visual viewport event it stayed. The shell shrank to its content
 * region's padding and iOS clipped the fixed case chat to it: black, from the
 * second open on (Arthur's recordings 3 and 5: content h 56 on every black frame).
 *
 * Numbers are Arthur's iPhone 13 in Chrome: 666 tall with no keyboard, 337 with. */

type Style = {
  setProperty: (name: string, value: string) => void;
  removeProperty: (name: string) => void;
  getPropertyValue: (name: string) => string;
};

function fakePage(innerHeight: number, viewportHeight: number) {
  const properties = new Map<string, string>();
  const style: Style = {
    setProperty: (name, value) => void properties.set(name, value),
    removeProperty: (name) => void properties.delete(name),
    getPropertyValue: (name) => properties.get(name) ?? '',
  };
  const viewport = Object.assign(new EventTarget(), { height: viewportHeight, width: 390, offsetTop: 0 });
  const win = Object.assign(new EventTarget(), {
    innerHeight,
    scrollY: 0,
    visualViewport: viewport,
    scrollTo: () => undefined,
  });
  const doc = Object.assign(new EventTarget(), {
    documentElement: { style },
    scrollingElement: { scrollTop: 0 },
    body: { scrollTop: 0 },
  });
  const globals = globalThis as Record<string, unknown>;
  globals.window = win;
  globals.document = doc;
  globals.requestAnimationFrame = (run: () => void) => {
    run();
    return 0;
  };
  const inset = (): string => style.getPropertyValue('--keyboard-inset');
  const done = (): void => {
    delete globals.window;
    delete globals.document;
    delete globals.requestAnimationFrame;
  };
  return { win, viewport, inset, done };
}

test('a resizing browser that reports the visual viewport first: the window resize brings the inset back to 0', () => {
  const page = fakePage(666, 666);
  try {
    const stop = syncKeyboardInset();
    assert.equal(page.inset(), '0px');

    // The keyboard rises. The visual viewport says so before innerHeight does.
    page.viewport.height = 337;
    page.viewport.dispatchEvent(new Event('resize'));
    assert.equal(page.inset(), '329px', 'read early, the inset is the keyboard height');

    // innerHeight catches up and the window says so.
    page.win.innerHeight = 337;
    page.win.dispatchEvent(new Event('resize'));
    assert.equal(page.inset(), '0px', 'the page already shrank, so nothing is subtracted twice');

    stop();
  } finally {
    page.done();
  }
});

test('an overlaying browser (Safari): innerHeight holds, so the inset stays the keyboard height', () => {
  const page = fakePage(844, 844);
  try {
    const stop = syncKeyboardInset();
    page.viewport.height = 508;
    page.viewport.dispatchEvent(new Event('resize'));
    assert.equal(page.inset(), '336px');
    page.win.dispatchEvent(new Event('resize'));
    assert.equal(page.inset(), '336px', 'a window resize changes nothing when innerHeight did not move');
    stop();
  } finally {
    page.done();
  }
});

test('the cleanup stops listening to the window and drops the property', () => {
  const page = fakePage(666, 337);
  try {
    const stop = syncKeyboardInset();
    assert.equal(page.inset(), '329px');
    stop();
    assert.equal(page.inset(), '');
    page.win.innerHeight = 337;
    page.win.dispatchEvent(new Event('resize'));
    assert.equal(page.inset(), '', 'no listener left on the window');
  } finally {
    page.done();
  }
});
