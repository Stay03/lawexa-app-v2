import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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
  // The held pair comes first, and exists only while the keyboard rises after a tap
  // and while the card fades out (the open and close tests below); otherwise the
  // card reads the visible viewport alone.
  assert.match(ask, /top: 'var\(--v2-case-chat-held-top, var\(--visual-top, 0px\)\)'/);
  assert.match(ask, /height: 'var\(--v2-case-chat-held-height, var\(--visual-height, 100dvh\)\)'/);
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
  // The shell's bars leave the tab order by `display: none` (pinned below), the
  // page's own regions by `inert`.
  assert.match(ask, /element\.style\.display = 'none';/);
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
  assert.match(card, /top: 'var\(--v2-case-chat-held-top, var\(--visual-top, 0px\)\)'/);
  assert.match(card, /height: 'var\(--v2-case-chat-held-height, var\(--visual-height, 100dvh\)\)'/);
  // The held pair has two writers, the open effect (a tap's hold) and the close
  // effect, and one reader, this style.
  assert.equal(ask.match(/setProperty\(\s*'--v2-case-chat-held-top'/g)?.length, 2);
  assert.equal(ask.match(/setProperty\(\s*'--v2-case-chat-held-height'/g)?.length, 2);
  assert.equal(ask.match(/var\(--v2-case-chat-held-top,/g)?.length, 1);
  assert.equal(ask.match(/var\(--v2-case-chat-held-height,/g)?.length, 1);
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
  // A layout effect, not a passive one: the screen ends from a timeout (CaseScreen's
  // holdover), so a passive cleanup ran after that commit had painted, and an offset
  // iOS had reset under the open chat showed the page's top for one frame before it
  // jumped back. The layout cleanup clears the overflow and puts the offset back
  // before the paint of the commit that returns the card to the pill.
  const lock = ask.match(/useLayoutEffect\(\(\) => \{\s*if \(!screenMounted\) return;\s*const scroller = document\.getElementById\(V2_SHELL_CONTENT_ID\);[\s\S]*?\}, \[screenMounted\]\);/)?.[0];
  assert.ok(lock, 'a layout effect keyed on the open screen locks the shell scroller');
  assert.doesNotMatch(ask, /useEffect\(\(\) => \{\s*if \(!screenMounted\) return;\s*const scroller/);
  assert.match(lock, /const readingTop = scroller\.scrollTop;/);
  assert.match(lock, /scroller\.style\.overflowY = 'hidden';/);
  // Removed on close (the effect's cleanup): overflow-y cleared, and the offset is the
  // one the reader left.
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
 * chrome and the debug readout (and a composer X, since removed: see below).
 *
 * His recordings after Done (12 October 2026): the card's top 56 px, its bar and X,
 * were cut. iOS clips the fixed card to the shell's content region, its DOM
 * ancestor, and the unpainted header still held the 56 px row above that region.
 * The header now takes no row while the phone chat is open. */

const chromeEffect = () => {
  const effect = ask.match(/useLayoutEffect\(\(\) => \{\s*if \(!screenMounted\) return;\s*const chrome = SHELL_CHROME[\s\S]*?\}, \[screenMounted\]\);/)?.[0];
  assert.ok(effect, 'a layout effect keyed on the open screen hides the shell bars');
  return effect;
};

test('while the phone chat is open the shell bars take no row, from its first frame', () => {
  const chrome = chromeEffect();
  assert.match(ask, /const SHELL_CHROME = \['\.v2-shell__header', '\.v2-shell__dock'\] as const;/);
  // `display: none`, which also takes them out of Tab and the accessibility tree.
  assert.match(chrome, /const display = chrome\.map\(\(element\) => element\.style\.display\);/);
  assert.match(chrome, /chrome\.forEach\(\(element\) => \{\s*element\.style\.display = 'none';\s*\}\);/);
  assert.match(chrome, /hide\(\);\s*window\.addEventListener\('pagehide', restore\);/, 'hidden at once, in the layout effect');
  // Restoring gives back whatever inline display each bar had.
  assert.match(chrome, /chrome\.forEach\(\(element, index\) => \{\s*element\.style\.display = display\[index\];\s*\}\);/);
  // No scroll is undone while the chat is open (the coordinator's review: iOS's own
  // scroll with the keyboard up is left alone, as on d720169).
  assert.doesNotMatch(ask, /restoreDocumentScroll/);
});

test('the bars must take no row, not merely no paint: the card is clipped to the content region', () => {
  // The fixed card is a DOM descendant of the content region (the dock renders in
  // the page, the page in the region), and iOS WebKit clips it to that region's
  // box. The region is grid row 2, under the header's `auto` row; a bar that is
  // only unpainted keeps its row, and the card's top 56 px were cut.
  const shellCss = read('v2', 'shell', 'shell.css');
  assert.match(shellCss, /\.v2-shell \{\s*display: grid;\s*grid-template-rows: auto 1fr auto;/);
  assert.match(shellCss, /\.v2-shell__content \{\s*grid-row: 2;\s*min-height: 0;\s*overflow-y: auto;/);
  assert.match(
    strip(read('v2', 'shell', 'AppShell.tsx')),
    /<div id=\{V2_SHELL_CONTENT_ID\} tabIndex=\{-1\} className="v2-shell__content">\s*\{children\}/,
  );
  const chrome = chromeEffect();
  assert.doesNotMatch(chrome, /visibility/);
  assert.doesNotMatch(chrome, /inert/);
});

test('nothing on the page moves with the bars: the region takes the rows they gave up as padding', () => {
  const chrome = chromeEffect();
  // The region's box is measured across the change and the difference, top and
  // bottom, is added to its padding, so every line keeps its pixel (the closing
  // fade shows the page) and the scroll range keeps its length (the offset is never
  // clamped, so the reading place is the same when the bars come back).
  assert.match(chrome, /const scroller = document\.getElementById\(V2_SHELL_CONTENT_ID\);\s*if \(!scroller\) return;/);
  assert.match(chrome, /const \{ paddingTop, paddingBottom \} = scroller\.style;/);
  assert.match(
    chrome,
    /const before = scroller\.getBoundingClientRect\(\);\s*chrome\.forEach\(\(element\) => \{\s*element\.style\.display = 'none';\s*\}\);\s*const after = scroller\.getBoundingClientRect\(\);/,
  );
  assert.match(chrome, /scroller\.style\.paddingTop = `\$\{parseFloat\(padding\.paddingTop\) \+ before\.top - after\.top\}px`;/);
  assert.match(chrome, /scroller\.style\.paddingBottom = `\$\{parseFloat\(padding\.paddingBottom\) \+ after\.bottom - before\.bottom\}px`;/);
  // Put back with the bars, in the same function, so `pagehide` restores both.
  assert.match(
    chrome,
    /element\.style\.display = display\[index\];\s*\}\);\s*scroller\.style\.paddingTop = paddingTop;\s*scroller\.style\.paddingBottom = paddingBottom;/,
  );
  // The reading line divides by the same range, so it holds too.
  assert.match(
    strip(read('v2', 'features', 'cases', 'detail', 'ReadingProgress.tsx')),
    /const max = scroller\.scrollHeight - scroller\.clientHeight;/,
  );
});

test('nothing in the bar replays or re-measures when it comes back', () => {
  // `display: none` to its old value restarts an element's CSS animations and wakes
  // any observer of its size. The bar and what it renders have neither.
  for (const file of ['V2Header.tsx', 'TunedHeader.tsx', 'V2NotificationBell.tsx', 'V2HeaderMenu.tsx', 'HomeTabs.tsx', 'Logo.tsx']) {
    const source = strip(read('v2', 'shell', file));
    assert.doesNotMatch(source, /animate-in|animate-\[|ResizeObserver|IntersectionObserver|getBoundingClientRect/, file);
  }
  const headerRule = read('v2', 'shell', 'shell.css').match(/\n\.v2-shell__header \{[^}]*\}/)?.[0];
  assert.ok(headerRule);
  assert.doesNotMatch(headerRule, /animation|transition/);
});

test("the phone bar's controls are 44 px targets; every other bar keeps its 32 px", () => {
  const bar = core.slice(core.indexOf('export function CaseChatBar'), core.indexOf('export function CaseChatMiddle'));
  assert.doesNotMatch(core.match(/const BAR_BUTTON =[^;]*;/)?.[0] ?? '', /size-/);
  assert.match(bar, /const target = screen \? 'size-11' : 'size-8';/);
  assert.match(bar, /const button = cn\(BAR_BUTTON, target, FOCUS_RING\);/);
  assert.equal(bar.match(/className=\{button\}/g)?.length, 3, 'back, open in full, close');
  // The 48 px bar holds them; the back button's spacer is the same size, so the
  // label stays centred.
  assert.match(bar, /tall \? 'min-h-12 px-2' : 'min-h-10 px-1\.5'/);
  // A conversation shows the back button; the new-chat view its spacer.
  assert.match(
    bar,
    /\{isConversation \? \(\s*<button\s+type="button"\s+onClick=\{onBack\}\s+aria-label="Back to your chats about this case"\s+className=\{button\}\s*>[\s\S]*?<\/button>\s*\) : \(\s*<span aria-hidden className=\{target\} \/>\s*\)\}/,
  );
  // Only the phone screen asks for them; the floating card and the docked column
  // keep the pointer size.
  assert.match(ask, /onClose=\{onClose\}\s+tall\s+screen\s*\/>/);
  assert.equal(ask.match(/<CaseChatBar/g)?.length, 2);
  assert.match(ask, /onClose=\{onClose\}\s+presentationAction=/);
  assert.match(panel, /onClose=\{onClose\}\s+tall\s+presentationAction=/);
});

test('the bars come back on every way out: each close, a route change, an unmount, leaving the page', () => {
  const chrome = chromeEffect();
  // The effect's cleanup restores them. It runs when the open screen ends (every
  // close) and when the component unmounts (a route change, or any unmount).
  assert.match(
    chrome,
    /return \(\) => \{\s*window\.removeEventListener\('pagehide', restore\);\s*window\.removeEventListener\('pageshow', onPageShow\);\s*restore\(\);\s*\};\s*\}, \[screenMounted\]\);$/,
  );
  // Every close ends the open screen: the bar's X and Escape call `onClose`, which
  // is CaseScreen's `closeChat`; Back adopts the URL without `chat`. (The composer's
  // X that also called it is gone; see the tests at the end.)
  assert.match(ask, /if \(event\.key === 'Escape'\) \{\s*event\.stopPropagation\(\);\s*onClose\(\);/);
  assert.match(ask, /<CaseChatBar\s+view=\{view\}\s+onBack=\{\(\) => onOpenChat\('new'\)\}\s+onClose=\{onClose\}\s+tall/);
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

test("the bar X is the open chat's one close, always there", () => {
  // The bar renders its close unconditionally, and nothing in it reads the keyboard.
  const bar = core.slice(core.indexOf('export function CaseChatBar'), core.indexOf('export function CaseChatMiddle'));
  assert.ok(bar.length > 0);
  assert.match(bar, /\) : null\}\s*<button\s+type="button"\s+onClick=\{onClose\}\s+aria-label="Close the chat"/);
  assert.doesNotMatch(bar, /v2-keyboard|keyboard/i);
  // The phone screen renders the bar in every open state, with no keyboard condition.
  assert.match(ask, /\{screenMounted \? \(\s*<div[\s\S]*?<CaseChatBar\s+view=\{view\}/);
  assert.doesNotMatch(ask, /v2-keyboard/);
});

/* Arthur's iPhone on da7be8d (12 October 2026). The composer's X is removed, so the
 * bar's X is the one close: the pins for that X, for the hook's keyboard-up flag and
 * for the composer's leading row are replaced by the absence pins below, and the
 * composer is back to its d720169 shape. Closing became one fade of a still card. */

/** Files under v2 and app (tests aside) that mention any of the patterns. */
const sourcesMentioning = (...patterns: string[]): string[] =>
  spawnSync('git', ['grep', '-l', ...patterns.flatMap((p) => ['-e', p]), '--', 'v2', 'app'], {
    encoding: 'utf8',
  })
    .stdout.trim()
    .split('\n')
    .filter((f) => f && !f.endsWith('.test.ts'));

test('the composer X and its keyboard-up flag are gone', () => {
  assert.doesNotMatch(core, /ComposerCloseButton|aria-label="Close chat"|leadingAction/);
  assert.doesNotMatch(composer, /leadingAction/);
  // The dock takes no close; the phone chat closes from the bar, Escape and Back.
  const dockProps = core.slice(core.indexOf('export function CaseChatComposerDock'));
  assert.doesNotMatch(dockProps.slice(0, dockProps.indexOf('}) {')), /onClose/);
  assert.match(ask, /onEngage=\{onEngage\}\s+stageRef=\{stageRef\}\s+\/>/);
  // The hook no longer says whether the keyboard is up, and nothing reads that flag.
  assert.doesNotMatch(keyboard, /data-v2-keyboard|KEYBOARD_MIN_HEIGHT|editableFocused/);
  assert.deepEqual(sourcesMentioning('v2-keyboard'), []);
});

test("the composer is back to d720169's shape: the pill is the composer's own child, full width", () => {
  // No row and no wrapper around the pill (da7be8d added both for the X). The pill's
  // className is the one it has always had. Line ends match \r?\n for a Windows
  // checkout (autocrlf).
  assert.doesNotMatch(composer, /<div className="flex items-end gap-1">/);
  assert.doesNotMatch(composer, /<div className="min-w-0 flex-1">\s*<PromptInput\b/);
  assert.match(composer, /\r?\n\s*className="shadow-\[0_6px_16px_-8px_rgba\(0,0,0,0\.28\)\]"\r?\n/);
  assert.equal(composer.match(/<PromptInputTextarea/g)?.length, 1);
});

/** The close effect: freezes the card, then puts the keyboard away. */
const closeEffect = () => {
  const effect = ask.match(/useLayoutEffect\(\(\) => \{\s*const closed = wasScreenOpen\.current && !screenOpen;[\s\S]*?\}, \[screenOpen, screenMounted\]\);/)?.[0];
  assert.ok(effect, 'a layout effect on the open state handles the close');
  return effect;
};

test('a close freezes the card at its measured top and height before the keyboard goes down', () => {
  const effect = closeEffect();
  // Measured, written, then the blur: the order is the point.
  assert.match(
    effect,
    /if \(screenMounted\) \{\s*const rect = card\.getBoundingClientRect\(\);\s*card\.style\.setProperty\('--v2-case-chat-held-top', `\$\{rect\.top\}px`\);\s*card\.style\.setProperty\('--v2-case-chat-held-height', `\$\{rect\.height\}px`\);\s*\}\s*const active = document\.activeElement;\s*if \(active instanceof HTMLElement && card\.contains\(active\)\) \{\s*active\.blur\(\);/,
  );
  // Dropped when the card leaves the screen or opens again mid-fade (the deps).
  assert.match(
    effect,
    /return \(\) => \{\s*card\.style\.removeProperty\('--v2-case-chat-held-top'\);\s*card\.style\.removeProperty\('--v2-case-chat-held-height'\);\s*\};\s*\}, \[screenOpen, screenMounted\]\);$/,
  );
  // Every close path runs it: each one ends `panelOpen` (`chat` null) first.
  assert.match(ask, /const screenOpen = screen && panelOpen;/);
  assert.match(screen, /panelOpen=\{chat !== null && dockOwnsChat\}/);
});

test('the dock, the page bars and the scroll lock come back only after the fade', () => {
  // The screen stays mounted through the fade: it is keyed on the held-over chat,
  // which drops 240 ms after the close, past the 200 ms fade.
  assert.match(ask, /const panelMounted = view !== null;/);
  assert.match(ask, /const screenMounted = screen && panelMounted;/);
  assert.match(screen, /view=\{dockOwnsChat \? renderedChat : null\}/);
  assert.match(screen, /window\.setTimeout\(\(\) => setRenderedChat\(null\), 240\)/);
  // The fixed card, the bars' hiding and the scroll lock all hang on screenMounted,
  // never on panelOpen, so none of them changes when the fade starts.
  assert.match(ask, /className=\{cn\(\s*'outline-none',\s*screenMounted\s*\?/);
  chromeEffect();
  assert.match(ask, /useLayoutEffect\(\(\) => \{\s*if \(!screenMounted\) return;\s*const scroller = document\.getElementById\(V2_SHELL_CONTENT_ID\);/);
  assert.doesNotMatch(ask, /if \(!screenOpen\) return;|if \(!panelOpen\) return;/);
});

test('the whole card fades out once, colour included; reduced motion skips the fade', () => {
  assert.match(ask, /data-state=\{screenMounted \? \(panelOpen \? 'open' : 'closed'\) : undefined\}/);
  // The exit sits on the card itself (the element with bg-popover), so the colour
  // fades with the contents.
  assert.match(
    ask,
    /'fixed inset-x-0 z-40 flex flex-col bg-popover pt-\[env\(safe-area-inset-top,0px\)\]',\s*'data-\[state=closed\]:pointer-events-none data-\[state=closed\]:motion-safe:animate-out data-\[state=closed\]:motion-safe:fade-out data-\[state=closed\]:motion-safe:duration-200 data-\[state=closed\]:fill-mode-forwards data-\[state=closed\]:motion-reduce:invisible',/,
  );
  // Once: the panel slot inside has no exit of its own, only the opening fade.
  assert.equal(ask.match(/animate-out/g)?.length, 1);
  assert.match(ask, /<div className="flex min-h-0 flex-1 flex-col [^"]*motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200[^"]*">/);
  // The opening is as it was: the card's colour is on from the first frame.
  assert.doesNotMatch(ask, /data-\[state=open\]/);
});

test('nothing inside the fading card moves: the jurisdiction row holds, and is down with no fold when the dock comes back', () => {
  // WebKit at iPhone 14 size (12 October 2026): the row's 300 ms grid-rows and
  // 200 ms opacity transitions started with the fade, because the row followed
  // `panelOpen`. On the phone it now follows the screen, which outlives the
  // fade; the floating card at xl keeps its fold with the panel.
  assert.match(ask, /showMeta=\{screen \? screenMounted : panelMounted && panelOpen\}/);
  // The row changes only with the screen, and that change has no transition:
  // the dock reappears with the row already collapsed. Inside the card
  // (opening) the transition is as it was.
  assert.match(ask, /animateMeta=\{!screen \|\| screenMounted\}/);
  assert.match(core, /animateMeta = true,/);
  assert.match(core, /showMeta=\{showMeta\}\s+animateMeta=\{animateMeta\}/);
  // False drops both transitions, the row's and the chip's; the classes are
  // otherwise the ones the row has always had, reduced motion included.
  assert.match(composer, /animateMeta = true,/);
  assert.match(
    composer,
    /inert=\{!showMeta\}\s+className=\{cn\(\s*'grid',\s*animateMeta &&\s*'transition-\[grid-template-rows\] duration-300 ease-\[cubic-bezier\(0\.32,0\.72,0,1\)\] motion-reduce:transition-none',\s*showMeta \? 'grid-rows-\[1fr\]' : 'grid-rows-\[0fr\]',/,
  );
  assert.match(
    composer,
    /'mb-2 flex flex-wrap items-center gap-2 px-1',\s*animateMeta && 'transition-opacity duration-200 motion-reduce:transition-none',\s*showMeta \? 'opacity-100' : 'opacity-0',/,
  );
  // Every other host leaves it at its default, so their rows are unchanged.
  assert.doesNotMatch(panel, /animateMeta/);
  assert.doesNotMatch(
    strip(read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx')),
    /animateMeta/,
  );
});

test('the composer is never remounted: one node, at a fixed place in the card', () => {
  // The card's children are the panel slot (one expression, `null` when closed) and
  // then the composer dock, unconditional and unkeyed. (`strip` leaves a JSX
  // comment as `{}`.)
  assert.match(
    ask,
    /\{screenMounted \? \(\s*<div className=\"flex min-h-0 flex-1 flex-col[\s\S]*?\) : panelMounted \? \([\s\S]*?\) : null\}\s*(?:\{\}\s*)?<CaseChatComposerDock\s+view=\{view\}/,
  );
  assert.equal(ask.match(/<CaseChatComposerDock/g)?.length, 1);
  const dock = ask.slice(ask.indexOf('<CaseChatComposerDock'), ask.indexOf('/>', ask.indexOf('<CaseChatComposerDock')));
  assert.doesNotMatch(dock, /\bkey=/);
  // Inside the dock the composer is rendered once, unkeyed, whatever the state.
  assert.equal(core.match(/<ConversationComposer\b/g)?.length, 1);
  const composerProps = core.slice(core.indexOf('<ConversationComposer'), core.indexOf('onSubmit=', core.indexOf('<ConversationComposer')));
  assert.doesNotMatch(composerProps, /\bkey=/);
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

/* Arthur's recordings of the open (12 October 2026): iOS reports the keyboard's end
 * geometry at its first event and pans the page for about 250 ms after it, so the
 * card was drawn low with the judgment above it and slid up. Opened by a tap, the
 * card now covers from the screen's top while the keyboard rises, its bar and
 * middle transparent, and takes the visible geometry once, the bar and middle
 * fading in. */

/** The open effect: the hold after a tap. */
const openEffect = () => {
  const effect = ask.match(/useLayoutEffect\(\(\) => \{\s*const card = cardRef\.current;\s*if \(!screenOpen \|\| !card\) return;\s*const active = document\.activeElement;[\s\S]*?\}, \[screenOpen\]\);/)?.[0];
  assert.ok(effect, 'a layout effect on the open state holds the card after a tap');
  return effect;
};

test('a tap opens the card held from the screen top to the visible bottom, for KEYBOARD_RISE_MS', () => {
  const effect = openEffect();
  assert.match(ask, /const KEYBOARD_RISE_MS = 350;/);
  // Only a focus in the card's box, which is the tap; a deep link focuses nothing.
  assert.match(effect, /if \(!\(active instanceof HTMLTextAreaElement\) \|\| !card\.contains\(active\)\) return;/);
  // The three writes: top at the layout viewport's top, bottom at the visible bottom.
  assert.match(effect, /card\.style\.setProperty\('--v2-case-chat-held-top', '0px'\);/);
  assert.match(
    effect,
    /card\.style\.setProperty\(\s*'--v2-case-chat-held-height',\s*'calc\(var\(--visual-top, 0px\) \+ var\(--visual-height, 100dvh\)\)',\s*\);/,
  );
  assert.match(effect, /card\.setAttribute\('data-keyboard', 'rising'\);/);
  // Released after the rise: the three writes undone.
  assert.match(effect, /timer = window\.setTimeout\(release, KEYBOARD_RISE_MS\);/);
  assert.match(
    effect,
    /const release = \(\): void => \{\s*stop\(\);\s*card\.style\.removeProperty\('--v2-case-chat-held-top'\);\s*card\.style\.removeProperty\('--v2-case-chat-held-height'\);\s*\};/,
  );
  assert.match(
    effect,
    /const stop = \(\): void => \{\s*window\.clearTimeout\(timer\);\s*active\.removeEventListener\('focusout', release\);\s*viewport\?\.removeEventListener\('resize', onResize\);\s*card\.removeAttribute\('data-keyboard'\);\s*\};/,
  );
  // Nothing goes through state, and the composer's node and focus are untouched.
  assert.doesNotMatch(effect, /(?<![.\w])set[A-Z]\w*\(|\.focus\(|\.blur\(/);
});

test('the hold cut short by a blur of the composer ends it at once, on the visible viewport', () => {
  const effect = openEffect();
  assert.match(effect, /active\.addEventListener\('focusout', release\);/);
  // `release` drops the held pair, so the card reads `--visual-top`/`--visual-height`,
  // which the keyboard hook keeps current as the keyboard goes down.
  assert.match(ask, /top: 'var\(--v2-case-chat-held-top, var\(--visual-top, 0px\)\)'/);
  assert.match(ask, /height: 'var\(--v2-case-chat-held-height, var\(--visual-height, 100dvh\)\)'/);
  // And until then the held height is live arithmetic on those variables, not a
  // number, so even a blur the listener missed leaves the bottom on the visible bottom.
  assert.doesNotMatch(effect, /'--v2-case-chat-held-height',\s*`/);
});

test('the hold cut short by a rotation or a width change ends it on the visible viewport', () => {
  const effect = openEffect();
  assert.match(effect, /const viewport = window\.visualViewport;\s*const width = viewport\?\.width;/);
  assert.match(effect, /const onResize = \(\): void => \{\s*if \(viewport\?\.width !== width\) release\(\);\s*\};/);
  assert.match(effect, /viewport\?\.addEventListener\('resize', onResize\);/);
  // Width, not height: the keyboard's own rise changes the height (and in the
  // home-screen app innerHeight), which must not end the hold.
  assert.doesNotMatch(effect, /innerHeight|viewport\?\.height/);
});

test('a close during the hold leaves the held pair for the close effect, which freezes the card where it is', () => {
  const effect = openEffect();
  // The cleanup is `stop`: the timer, the listeners and the attribute go, the held
  // pair stays. React runs a component's layout cleanups before its layout effects,
  // so the close effect then measures the card at its held geometry (covering from
  // the top) and writes that rect over the pair; its own cleanup drops the pair.
  assert.match(effect, /return stop;\s*\}, \[screenOpen\]\);$/);
  const close = closeEffect();
  assert.match(close, /const rect = card\.getBoundingClientRect\(\);\s*card\.style\.setProperty\('--v2-case-chat-held-top', `\$\{rect\.top\}px`\);/);
  assert.match(close, /return \(\) => \{\s*card\.style\.removeProperty\('--v2-case-chat-held-top'\);\s*card\.style\.removeProperty\('--v2-case-chat-held-height'\);\s*\};/);
  // Every falling edge of screenOpen runs the close path, so a pair left on the card
  // never outlives the close: it is gone before any later open.
  assert.match(close, /const closed = wasScreenOpen\.current && !screenOpen;/);
});

test('the slot is transparent and takes no tap during the hold, then fades in once; reduced motion, no fade', () => {
  assert.match(
    ask,
    /<div className="flex min-h-0 flex-1 flex-col transition-opacity duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 motion-reduce:transition-none in-data-\[keyboard=rising\]:pointer-events-none in-data-\[keyboard=rising\]:opacity-0">/,
  );
  // The deep link keeps the mount fade; nothing slides.
  assert.doesNotMatch(ask, /slide-in|slide-out/);
  // C' stays true: the composer's X and the hook's keyboard flag are gone.
  assert.doesNotMatch(ask, /v2-keyboard|editableFocused/);
});
