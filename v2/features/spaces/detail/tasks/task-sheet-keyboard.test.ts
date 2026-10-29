import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { keyboardOcclusion, syncKeyboardInset } from '@/v2/shell/use-keyboard-inset';
import { scrollTopToReveal } from '@/v2/shell/reveal-in-scroller';
import { pickerChoices } from './task-sheet-model';

/* The task sheet on a phone with the keyboard up (Arthur, 29 October 2026,
 * 21:13Z, thread 7aa0c6d8: "The keyboard covers the entry form and the threads
 * selection too"). His iPhone showed everything under the Title behind the
 * keyboard, and the Thread list running down over the footer and off the
 * screen. */

const read = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), 'utf8');
const sheet = () => read('v2', 'features', 'spaces', 'detail', 'tasks', 'TaskSheet.tsx');

// ── The numbers ─────────────────────────────────────────────────────────────

test('the keyboard covers nothing with no keyboard, its height in Safari, and nothing where the page resizes', () => {
  // No keyboard: the visible rectangle is the whole layout viewport.
  assert.equal(keyboardOcclusion(844, 844, 0), 0);
  // Safari overlays: innerHeight holds, the visible height drops.
  assert.equal(keyboardOcclusion(844, 508, 0), 336);
  // Safari panned to the focused field: the pan is visible, not covered.
  assert.equal(keyboardOcclusion(844, 508, 200), 136);
  // Chrome on Android (and Chrome on iPhone) resize: both heights drop together.
  assert.equal(keyboardOcclusion(337, 337, 0), 0);
  // Rubber-band scrolling can read past the bottom; never below 0.
  assert.equal(keyboardOcclusion(844, 508, 400), 0);
});

type Style = {
  setProperty: (name: string, value: string) => void;
  removeProperty: (name: string) => void;
  getPropertyValue: (name: string) => string;
};

/** A phone page the keyboard hook can run against. */
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
  const px = (name: string): number => Number.parseFloat(style.getPropertyValue(name));
  /** Where the sheet's CSS puts it: its bottom at `--visual-top` +
   *  `--visual-height`, its height capped at `--visual-height` less 2.5rem. */
  const sheetBox = () => ({ bottom: px('--visual-top') + px('--visual-height'), maxHeight: px('--visual-height') - 40 });
  const done = (): void => {
    delete globals.window;
    delete globals.document;
    delete globals.requestAnimationFrame;
  };
  return { win, viewport, sheetBox, done };
}

test('Safari: the sheet stands on the keyboard and fits the visible height, panned or not', () => {
  const page = fakePage(844, 844);
  try {
    const stop = syncKeyboardInset();
    assert.deepEqual(page.sheetBox(), { bottom: 844, maxHeight: 804 }, 'no keyboard: the screen bottom');

    page.viewport.height = 508;
    page.viewport.dispatchEvent(new Event('resize'));
    assert.deepEqual(page.sheetBox(), { bottom: 844 - 336, maxHeight: 468 }, 'the keyboard top');

    // iOS pans the page to the focused field: the sheet follows the pan.
    page.viewport.offsetTop = 200;
    page.viewport.dispatchEvent(new Event('scroll'));
    const box = page.sheetBox();
    assert.equal(box.bottom, 844 - keyboardOcclusion(844, 508, 200));
    assert.equal(box.bottom, 708);
    stop();
  } finally {
    page.done();
  }
});

test('Chrome on Android: the page itself shrinks, so the sheet stands on the new bottom', () => {
  const page = fakePage(780, 780);
  try {
    const stop = syncKeyboardInset();
    page.win.innerHeight = 460;
    page.viewport.height = 460;
    page.viewport.dispatchEvent(new Event('resize'));
    page.win.dispatchEvent(new Event('resize'));
    assert.deepEqual(page.sheetBox(), { bottom: 460, maxHeight: 420 });
    stop();
  } finally {
    page.done();
  }
});

test('a focused field is scrolled into the sheet body, moving as little as it can', () => {
  const box = { scrollTop: 100, top: 100, bottom: 400 };
  // Already in view: nothing moves.
  assert.equal(scrollTopToReveal(box, { top: 200, bottom: 236 }, 16), 100);
  // Under the bottom edge (behind the footer): down by what is hidden plus the margin.
  assert.equal(scrollTopToReveal(box, { top: 390, bottom: 426 }, 16), 100 + 42);
  // Above the top edge: up by what is hidden plus the margin.
  assert.equal(scrollTopToReveal(box, { top: 90, bottom: 126 }, 16), 100 - 26);
  // Never above the top of the body.
  assert.equal(scrollTopToReveal({ scrollTop: 5, top: 100, bottom: 400 }, { top: 50, bottom: 86 }, 16), 0);
  // Taller than the body: its top shows.
  assert.equal(scrollTopToReveal(box, { top: 300, bottom: 900 }, 16), 100 + 184);
});

test('the phone pickers show names and send uuids, with the same empty choice as the computer', () => {
  const people = [
    { uuid: '6b1f0c1e-uuid-ada', name: 'Ada Obi' },
    { uuid: '9d2a7e40-uuid-bayo', name: 'Bayo Ade' },
  ];
  const owner = pickerChoices(people, 'Nobody yet');
  assert.deepEqual(owner, [
    { value: '', label: 'Nobody yet', disabled: false },
    { value: '6b1f0c1e-uuid-ada', label: 'Ada Obi', disabled: false },
    { value: '9d2a7e40-uuid-bayo', label: 'Bayo Ade', disabled: false },
  ]);
  for (const choice of owner.slice(1)) {
    assert.doesNotMatch(choice.label, /uuid/, 'a line reads the name, never the uuid');
  }
  // Waiting on: no empty choice, a placeholder that cannot be picked.
  assert.deepEqual(pickerChoices(people, null, 'Choose a person')[0], {
    value: '',
    label: 'Choose a person',
    disabled: true,
  });
  // Thread: "No thread" first, then each room by its name.
  assert.deepEqual(pickerChoices([{ uuid: 'room-uuid-1', name: 'general' }], 'No thread'), [
    { value: '', label: 'No thread', disabled: false },
    { value: 'room-uuid-1', label: 'general', disabled: false },
  ]);
});

// ── The sheet's source ──────────────────────────────────────────────────────

test('the sheet moves onto the keyboard on the bottom side only', () => {
  const source = sheet();
  assert.match(
    source,
    /'data-\[side=bottom\]:bottom-auto data-\[side=bottom\]:top-\[calc\(var\(--visual-top,0px\)\+var\(--visual-height,100dvh\)\)\] data-\[side=bottom\]:-translate-y-full data-\[side=bottom\]:max-h-\[calc\(var\(--visual-height,100dvh\)-2\.5rem\)\]'/,
  );
  // Nothing keyboard-shaped reaches the computer's right-hand sheet.
  assert.doesNotMatch(source, /data-\[side=right\]:[^\s']*(?:visual|keyboard)/);
  assert.doesNotMatch(source, /(?<![\w\]:-])(?:top-\[calc\(var\(--visual|-translate-y-full)/);
  // The old cap stood on the page's bottom, behind the keyboard.
  assert.doesNotMatch(source, /max-h-\[92svh\]/);
});

test('the phone gets the native pickers, the computer keeps the Radix list', () => {
  const source = sheet();
  assert.match(source, /const native = side === 'bottom';/);
  assert.match(source, /if \(native\) \{\s*return \(\s*<div className="relative">\s*<select\s+id=\{id\}\s+value=\{value \?\? ''\}/);
  assert.match(source, /aria-invalid=\{invalid \|\| undefined\}\s+aria-describedby=\{describedBy\}/);
  assert.match(
    source,
    /\{pickerChoices\(options, emptyLabel, placeholder\)\.map\(\(choice\) => \(\s*<option key=\{choice\.value\} value=\{choice\.value\} disabled=\{choice\.disabled\}>\s*\{choice\.label\}\s*<\/option>/,
  );
  // The Radix list is still there for a computer.
  assert.match(source, /<SelectItem key=\{option\.uuid\} value=\{option\.uuid\}>\s*\{option\.name\}\s*<\/SelectItem>/);
  // Owner keeps "Nobody yet", Waiting on its placeholder, Thread "No thread",
  // and each passes the phone flag.
  assert.match(source, /<ChoiceSelect\s+id=\{`\$\{uid\}-owner`\}\s+native=\{native\}[\s\S]*?emptyLabel="Nobody yet"/);
  assert.match(
    source,
    /<ChoiceSelect\s+id=\{`\$\{uid\}-waiting`\}\s+native=\{native\}[\s\S]*?emptyLabel=\{null\}\s+placeholder="Choose a person"/,
  );
  assert.match(source, /<ThreadSelect\s+id=\{`\$\{uid\}-thread`\}\s+native=\{native\}/);
  assert.match(source, /<ChoiceSelect[\s\S]*?emptyLabel="No thread"/);
});

test('a focused field is revealed inside the sheet body, not by scrolling the page', () => {
  const source = sheet();
  assert.match(source, /<div\s+ref=\{bodyRef\}\s+onFocus=\{revealFocused\}/);
  assert.match(source, /cancelReveal\.current = revealAfterKeyboard\(box, event\.target\);/);
  assert.doesNotMatch(source, /scrollIntoView/);
  const reveal = read('v2', 'shell', 'reveal-in-scroller.ts');
  // It waits for the visual viewport's resize to settle, with a fallback.
  assert.match(reveal, /viewport\?\.addEventListener\('resize', onResize\);/);
  assert.match(reveal, /timer = window\.setTimeout\(finish, REVEAL_FALLBACK_MS\);/);
  assert.match(reveal, /box\.scrollTo\(\{ top: next,/);
  assert.doesNotMatch(reveal, /scrollIntoView\(/);
});
