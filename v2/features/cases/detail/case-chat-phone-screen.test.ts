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

/* Arthur's iPhone on d720169 (12 October 2026): with the keyboard up the page's bar
 * painted over the chat's own bar, so nothing on screen closed the chat. The card's
 * position stays as on d720169 (pinned above); what is new is the hidden page
 * chrome, the composer's X and the debug readout. */

const chromeEffect = () => {
  const effect = ask.match(/useLayoutEffect\(\(\) => \{\s*if \(!screenMounted\) return;\s*const chrome = SHELL_CHROME[\s\S]*?\}, \[screenMounted\]\);/)?.[0];
  assert.ok(effect, 'a layout effect keyed on the open screen hides the shell bars');
  return effect;
};

test('while the phone chat is open the shell bars are inert and not painted, from its first frame', () => {
  const chrome = chromeEffect();
  assert.match(ask, /const SHELL_CHROME = \['\.v2-shell__header', '\.v2-shell__dock'\] as const;/);
  // Hidden from paint and, through `inert`, from Tab and the accessibility tree.
  assert.match(chrome, /element\.setAttribute\('inert', ''\);\s*element\.style\.visibility = 'hidden';/);
  assert.match(chrome, /hide\(\);\s*window\.addEventListener\('pagehide', restore\);/, 'hidden at once, in the layout effect');
  // Restoring gives back whatever visibility each bar had and drops `inert`.
  assert.match(chrome, /element\.removeAttribute\('inert'\);\s*element\.style\.visibility = visibility\[index\];/);
  // No scroll is undone while the chat is open (the coordinator's review: iOS's own
  // scroll with the keyboard up is left alone, as on d720169).
  assert.doesNotMatch(ask, /restoreDocumentScroll/);
});

test('the bars come back on every way out: each close, a route change, an unmount, leaving the page', () => {
  const chrome = chromeEffect();
  // The effect's cleanup restores them. It runs when the open screen ends (every
  // close) and when the component unmounts (a route change, or any unmount).
  assert.match(
    chrome,
    /return \(\) => \{\s*window\.removeEventListener\('pagehide', restore\);\s*window\.removeEventListener\('pageshow', onPageShow\);\s*restore\(\);\s*\};\s*\}, \[screenMounted\]\);$/,
  );
  // Every close ends the open screen: the bar's X, the composer's X and Escape call
  // `onClose`, which is CaseScreen's `closeChat`; Back adopts the URL without `chat`.
  assert.match(ask, /if \(event\.key === 'Escape'\) \{\s*event\.stopPropagation\(\);\s*onClose\(\);/);
  assert.match(ask, /<CaseChatBar\s+view=\{view\}\s+onBack=\{\(\) => onOpenChat\('new'\)\}\s+onClose=\{onClose\}\s+tall/);
  assert.match(ask, /onClose=\{screenMounted \? onClose : undefined\}/);
  assert.match(screen, /onClose=\{closeChat\}/);
  assert.match(screen, /const closeChat = useCallback\(\(\) => \{\s*setChat\(null\);/);
  assert.match(screen, /setChat\(new URLSearchParams\(window\.location\.search\)\.get\('chat'\)\);/);
  // The dock's open screen is the held-over chat on a phone, so a closed chat ends it.
  assert.match(screen, /view=\{dockOwnsChat \? renderedChat : null\}/);
  assert.match(ask, /const screenMounted = screen && panelMounted;/);
  // Leaving the page gives them back, so a page in the back-forward cache never holds
  // hidden bars; a persisted return with the chat still open hides them again.
  assert.match(chrome, /window\.addEventListener\('pagehide', restore\);/);
  assert.match(chrome, /const onPageShow = \(event: PageTransitionEvent\): void => \{\s*if \(event\.persisted\) hide\(\);\s*\};/);
  assert.match(chrome, /window\.addEventListener\('pageshow', onPageShow\);/);
});

test('the bar X is always there in the open chat; the composer X is only an extra', () => {
  // The bar renders its close unconditionally, and nothing in it reads the keyboard flag.
  const bar = core.slice(core.indexOf('export function CaseChatBar'), core.indexOf('export function CaseChatMiddle'));
  assert.ok(bar.length > 0);
  assert.match(bar, /\) : null\}\s*<button\s+type="button"\s+onClick=\{onClose\}\s+aria-label="Close the chat"/);
  assert.doesNotMatch(bar, /v2-keyboard|keyboard/i);
  // The phone screen renders the bar in every open state, with no keyboard condition.
  assert.match(ask, /\{screenMounted \? \(\s*<div[\s\S]*?<CaseChatBar\s+view=\{view\}/);
  assert.doesNotMatch(ask, /v2-keyboard/);
});

test('the hook says when the keyboard is up: a typing field focused and the visible height a keyboard short', () => {
  assert.match(keyboard, /const keyboardUp = editableFocused\(\) && fullHeight - viewport\.height >= KEYBOARD_MIN_HEIGHT;/);
  assert.match(keyboard, /if \(keyboardUp\) root\.setAttribute\('data-v2-keyboard', 'up'\);\s*else root\.removeAttribute\('data-v2-keyboard'\);/);
  assert.match(keyboard, /fullHeight = Math\.max\(fullHeight, viewport\.height\);/);
  assert.match(keyboard, /const KEYBOARD_MIN_HEIGHT = 150;/);
  assert.match(keyboard, /root\.removeAttribute\('data-v2-keyboard'\);\s*\};\s*\}, \[\]\);/, 'cleared on unmount');
  // Read on focusin too, so the card's first frame is sized from the tap.
  assert.match(keyboard, /document\.addEventListener\('focusin', publishVisible\);/);
  assert.match(keyboard, /document\.removeEventListener\('focusin', publishVisible\);/);
});

test('the composer row carries a "Close chat" X while the keyboard is up, on the bar X\'s close path', () => {
  const button = core.match(/function ComposerCloseButton[\s\S]*?\n\}/)?.[0];
  assert.ok(button, 'the close button has its own component');
  assert.match(button, /aria-label="Close chat"/);
  assert.match(button, /onClick=\{onClose\}/);
  // At least 44x44 CSS px.
  assert.match(button, /\bsize-11\b/);
  // Hidden unless the hook says the keyboard is up.
  assert.match(button, /'v2-interactive hidden size-11 [^']*in-data-\[v2-keyboard=up\]:flex'/);
  // The press keeps focus in the box, so the keyboard and the button stay until the click.
  assert.match(button, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
  // Only the phone full screen passes a close, and it is the same `onClose` as the bar's X.
  assert.match(ask, /onClose=\{screenMounted \? onClose : undefined\}/);
  assert.match(ask, /<CaseChatBar\s+view=\{view\}\s+onBack=\{\(\) => onOpenChat\('new'\)\}\s+onClose=\{onClose\}\s+tall/);
  assert.match(core, /leadingAction=\{onClose \? <ComposerCloseButton onClose=\{onClose\} \/> : null\}/);
});

test("the composer's leading slot sits outside the pill, in a row that is always there", () => {
  // The row is unconditional, so the slot coming and going never remounts the box.
  // (`strip` leaves a JSX comment as `{}`.)
  assert.match(
    composer,
    /<div className="flex items-end gap-1">\s*\{leadingAction\}\s*(?:\{\}\s*)?<div className="min-w-0 flex-1">\s*<PromptInput\b/,
  );
  assert.equal(composer.match(/<PromptInputTextarea/g)?.length, 1);
});

test('with no leading control every composer host keeps the full-width pill it had on d720169', () => {
  // PromptInput's className lands on its INNER box; the flex item is its outer
  // shimmer box, which shrank to its content when the row was added (pixel compare
  // of 9237bf3: /c/{id} pill 416 px to 207 px at 1280). The box around the pill is
  // the flex item and takes the row's free width, and the pill's own className is
  // unchanged from d720169. Line ends match \r?\n: a Windows checkout (autocrlf)
  // gives this file CRLF endings, and a bare \n never matches there.
  assert.match(composer, /<div className="min-w-0 flex-1">\s*<PromptInput\b/);
  assert.match(composer, /\r?\n\s*className="shadow-\[0_6px_16px_-8px_rgba\(0,0,0,0\.28\)\]"\r?\n/);
  assert.doesNotMatch(composer, /className="min-w-0 flex-1 shadow-/);
});

test('the keyboard readout loads only with ?kbdebug=1 and listens only while mounted', () => {
  // No static import: the module is fetched only when the flag renders it.
  assert.doesNotMatch(screen, /^import .*KeyboardDebugReadout/m);
  assert.match(screen, /const KeyboardDebugReadout = dynamic\(\s*\(\) => import\('\.\/KeyboardDebugReadout'\)/);
  assert.match(screen, /\{ ssr: false \}/);
  assert.match(screen, /const keyboardDebug = searchParams\.get\('kbdebug'\) === '1';/);
  assert.match(screen, /\{keyboardDebug \? <KeyboardDebugReadout \/> : null\}/);
  const readout = detail('KeyboardDebugReadout.tsx');
  // Every listener is added inside the one mount effect and removed in its cleanup.
  const effect = readout.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/)?.[0];
  assert.ok(effect);
  const adds = readout.match(/addEventListener\(/g)?.length ?? 0;
  assert.ok(adds > 0);
  assert.equal(effect.match(/addEventListener\(/g)?.length, adds);
  assert.equal(effect.match(/removeEventListener\(/g)?.length, adds);
  // Never takes a tap, and reads no user data from the page (no field values, no text, no ids).
  assert.match(readout, /pointer-events-none fixed left-0/);
  assert.doesNotMatch(readout, /\.value\b|innerText|\.id\b|textContent\s*[^=\s]/);
});
