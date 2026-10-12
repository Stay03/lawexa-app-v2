import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The case chat on a phone (Arthur, approved by Stay, 11 October 2026): ONE tap on
 * "Ask about this case" opens the chat full screen with the keyboard up, the composer
 * sits on the keyboard, and closing returns to the same place in the judgment.
 *
 * WebKit opens the keyboard only for a focus inside the reader's gesture, so the box
 * the reader taps must BE the open chat's composer: the dock grows around it instead of
 * a sheet mounting a second box (which needed its own tap). These are .tsx, so the
 * wiring is pinned by source; the keyboard, geometry and scroll position are checked
 * in a browser. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
const detail = (file: string) => strip(read('v2', 'features', 'cases', 'detail', file));
const ask = detail('CaseAsk.tsx');
const screen = detail('CaseScreen.tsx');
const panel = detail('CaseChatPanel.tsx');
const core = detail('CaseChatCore.tsx');
const composer = strip(read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'));
const keyboard = strip(read('v2', 'shell', 'use-keyboard-inset.ts'));

test('no box is read-only or focused by code: the tap itself focuses the composer', () => {
  const hits = execFileSync('git', ['grep', '-l', '-e', 'engageWithoutKeyboard', '--', 'v2', 'app'], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter((f) => f && !f.endsWith('.test.ts'));
  assert.deepEqual(hits, []);
  assert.doesNotMatch(composer, /readOnly=/);
  assert.doesNotMatch(composer, /autoFocus/);
  for (const source of [ask, panel, core]) assert.doesNotMatch(source, /autoFocus/);
  assert.match(composer, /onFocus=\{onEngage\}/);
});

test('the phone sheet is gone; the dock owns the chat on a phone, with one composer', () => {
  assert.doesNotMatch(panel, /CaseChatSheet/);
  assert.doesNotMatch(screen, /CaseChatSheet|showSheet/);
  assert.match(screen, /const phone = isDesktopPanel === false;/);
  assert.match(screen, /const dockOwnsChat = phone \|\| floatingContext;/);
  assert.match(screen, /const showDock = dockOwnsChat \|\| renderedChat === null;/);
  assert.match(screen, /screen=\{phone\}/);
  assert.equal(ask.match(/<CaseChatComposerDock/g)?.length, 1, 'one composer in the dock');
  assert.equal(panel.match(/<CaseChatComposerDock/g)?.length, 1, 'one composer in the docked column');
});

test('the open phone card is the visible viewport, with no slide', () => {
  assert.match(ask, /top: 'var\(--visual-top, 0px\)'/);
  assert.match(ask, /height: 'var\(--visual-height, 100dvh\)'/);
  assert.doesNotMatch(ask, /--keyboard-inset/);
  assert.doesNotMatch(ask, /slide-in-from-bottom|slide-out-to-bottom/);
  assert.match(ask, /arrive && !screenMounted/);
});

test('the open phone card stacks above the page (reading line z-20, bar z-30)', () => {
  // The sticky wrapper is a stacking context, so it is the wrapper that rises.
  assert.match(ask, /screenMounted \? 'z-40' : 'z-10'/);
});

test('the page keeps its length while the card is out of the flow', () => {
  assert.match(ask, /setProperty\('--v2-case-dock-h'/);
  assert.match(ask, /minHeight: 'var\(--v2-case-dock-h, auto\)'/);
  assert.match(ask, /new ResizeObserver/);
});

test('closing puts the keyboard away and never moves the judgment', () => {
  assert.match(ask, /active\.blur\(\);\s*card\.focus\(\{ preventScroll: true \}\);/);
  // The rendered markup (from the wrapper down) focuses nothing: only the close
  // effect above it moves focus.
  const markup = ask.slice(ask.indexOf('ref={wrapperRef}'));
  assert.doesNotMatch(markup, /\.focus\(/, 'nothing focuses on open');
});

test('the phone chat is a modal dialog that Escape closes and a status line announces', () => {
  assert.match(ask, /role=\{screenMounted \? 'dialog'/);
  assert.match(ask, /aria-modal=\{screenMounted \? true : undefined\}/);
  assert.match(ask, /event\.key === 'Escape'/);
  assert.match(ask, /role="status"/);
  assert.match(ask, /setAttribute\('inert', ''\)/);
  assert.match(screen, /inert=\{pageUnderChat\}/);
});

test('the keyboard hook publishes the visible height and offset beside the inset, and clears them', () => {
  // One writer for both, called on every update, on the blur path and on focusin
  // (12 October 2026: the two inline copies became `publishVisible`).
  const heights = keyboard.match(/setProperty\('--visual-height', `\$\{viewport\.height\}px`\)/g) ?? [];
  const tops = keyboard.match(/setProperty\('--visual-top', `\$\{top\}px`\)/g) ?? [];
  assert.equal(heights.length, 1, 'height written in one place');
  assert.equal(tops.length, 1, 'offset written in one place');
  assert.equal(keyboard.match(/publishVisible\(\);/g)?.length, 2, 'every update and the blur path publish it');
  assert.match(keyboard, /removeProperty\('--visual-height'\)/);
  assert.match(keyboard, /removeProperty\('--visual-top'\)/);
});

test('with the keyboard down the published top is 0, so the chat covers the page bar', () => {
  // iOS can report the full height while offsetTop still holds the keyboard's pan;
  // the published top is clamped to where a visible rectangle can be. The limit is
  // the tallest visible height at this width, never innerHeight, which shrinks with
  // the keyboard in the home-screen app (Arthur's IMG_4108, 12 October 2026). The
  // arithmetic itself is pinned by behaviour in v2/shell/keyboard-visible-top.test.ts.
  assert.match(keyboard, /const top = visibleTop\(viewport\.offsetTop, viewport\.height, fullHeight\);/);
  assert.match(keyboard, /fullHeight = Math\.max\(fullHeight, viewport\.height\);/);
  assert.doesNotMatch(keyboard, /Math\.min\(viewport\.offsetTop, window\.innerHeight/);
  assert.doesNotMatch(keyboard, /setProperty\('--visual-top', `\$\{viewport\.offsetTop\}px`\)/);
  // The tap is a focus: the card's first frame is sized from the viewport at the tap.
  assert.match(keyboard, /document\.addEventListener\('focusin', publishVisible\);/);
  assert.match(keyboard, /document\.removeEventListener\('focusin', publishVisible\);/);
  // And the dialog's own layer is above the shell's bar (z-30 at most).
  assert.match(ask, /screenMounted \? 'z-40' : 'z-10'/);
});

test('the open card is full size and opaque from its first frame, whatever is loading inside', () => {
  // Its size comes from the viewport alone: the fixed card's style reads only the two
  // viewport variables, and nothing in the screen branch depends on a query state.
  const styles = [...ask.matchAll(/style=\{\s*screenMounted\s*\?\s*\{([\s\S]*?)\}\s*:\s*undefined\s*\}/g)].map((m) => m[1]);
  const card = styles.find((body) => body.includes('--visual-top'));
  assert.ok(card, 'the fixed card has a style of its own');
  const keys = [...card.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ['top', 'height']);
  assert.match(card, /top: 'var\(--visual-top, 0px\)'/);
  assert.match(card, /height: 'var\(--visual-height, 100dvh\)'/);
  assert.doesNotMatch(ask, /isPending|isLoading|isFetching/);
  // The loading rows sit in the middle, which fills the card and scrolls by itself.
  assert.match(core, /className="min-h-0 flex-1 motion-safe:animate-in/);
  assert.match(core, /className="v2-quiet-scroll h-full min-h-0 overflow-y-auto overscroll-contain px-4 py-4"/);
  // No colour fade on the phone card: the page never shows through it.
  assert.match(ask, /'fixed inset-x-0 z-40 flex flex-col bg-popover pt-\[env\(safe-area-inset-top,0px\)\]'/);
  assert.match(ask, /'mx-auto w-full max-w-\[26rem\] rounded-2xl border transition-\[background-color,box-shadow,border-color\] duration-300/);
  assert.equal(ask.match(/transition-\[background-color/g)?.length, 1, "the colour transition is the floating card's only");
});

test('while the phone chat is open the page under it cannot scroll, and closing keeps the reading place', () => {
  assert.match(ask, /import \{ V2_SHELL_CONTENT_ID \} from '@\/v2\/shell\/shell-content';/);
  const lock = ask.match(/useEffect\(\(\) => \{\s*if \(!screenMounted\) return;\s*const scroller = document\.getElementById\(V2_SHELL_CONTENT_ID\);[\s\S]*?\}, \[screenMounted\]\);/)?.[0];
  assert.ok(lock, 'an effect keyed on the open screen locks the shell scroller');
  assert.match(lock, /const readingTop = scroller\.scrollTop;/);
  assert.match(lock, /scroller\.style\.overflowY = 'hidden';/);
  // Removed on close (the effect's cleanup) and the offset is the one the reader left.
  assert.match(
    lock,
    /return \(\) => \{\s*scroller\.style\.overflowY = previousOverflow;\s*if \(scroller\.scrollTop !== readingTop\) scroller\.scrollTop = readingTop;\s*\};\s*\}, \[screenMounted\]\);/,
  );
  // The chat's own scrollers keep their drags (both contain their overscroll).
  assert.match(core, /overflow-y-auto overscroll-contain/);
  assert.match(
    strip(read('v2', 'features', 'conversations', 'conversation', 'MessageList.tsx')),
    /overflow-y-auto overscroll-contain/,
  );
});

test('the keyboard inset itself is unchanged for every other screen', () => {
  const insets = keyboard.match(/setProperty\('--keyboard-inset', `\$\{occlusion\}px`\)/g) ?? [];
  assert.equal(insets.length, 2);
  assert.match(keyboard, /window\.innerHeight - viewport\.height - viewport\.offsetTop/);
});
