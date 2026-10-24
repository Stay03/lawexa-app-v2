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
// The chat a document page hosts (open/close, holdover, presentation): the case
// page's, shared with the statute page since 18 October 2026.
const host = detail('use-document-chat.ts');
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
  assert.match(host, /const phone = isDesktopPanel === false;/);
  assert.match(host, /const dockOwnsChat = phone \|\| \(isDesktopPanel === true && !docked\);/);
  assert.match(host, /const showDock = dockOwnsChat \|\| renderedChat === null;/);
  assert.match(screen, /screen=\{phone\}/);
  assert.equal(ask.match(/<CaseChatComposerDock/g)?.length, 1, 'one composer in the dock');
  assert.equal(panel.match(/<CaseChatComposerDock/g)?.length, 1, 'one composer in the docked column');
});

test('the open phone card is the visible viewport, with no slide', () => {
  // The held pair comes first, and exists only while the keyboard rises and while
  // the card fades out (the hold and close tests below); otherwise the card reads
  // the visible viewport alone.
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
  assert.match(screen, /inert=\{pageUnder\}/);
  assert.match(screen, /const pageUnder = pageUnderChat \|\| editorShown;/);
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
  assert.deepEqual(keys, ['top', 'height', 'paddingTop']);
  assert.match(card, /top: 'var\(--v2-case-chat-held-top, var\(--visual-top, 0px\)\)'/);
  assert.match(card, /height: 'var\(--v2-case-chat-held-height, var\(--visual-height, 100dvh\)\)'/);
  // The status bar's inset, plus the riding pad while the keyboard rises.
  assert.match(card, /paddingTop: 'calc\(env\(safe-area-inset-top, 0px\) \+ var\(--v2-case-chat-held-pad, 0px\)\)'/);
  // The held pair has two writers, the hold effect (a keyboard's rise) and the
  // close effect, and one reader, this style.
  assert.equal(ask.match(/setProperty\(\s*'--v2-case-chat-held-top'/g)?.length, 2);
  assert.equal(ask.match(/setProperty\(\s*'--v2-case-chat-held-height'/g)?.length, 2);
  assert.equal(ask.match(/var\(--v2-case-chat-held-top,/g)?.length, 1);
  assert.equal(ask.match(/var\(--v2-case-chat-held-height,/g)?.length, 1);
  assert.doesNotMatch(ask, /isPending|isLoading|isFetching/);
  // The loading rows sit in the middle, which fills the card and scrolls by itself.
  assert.match(core, /className="min-h-0 flex-1 motion-safe:animate-in/);
  assert.match(core, /className="v2-quiet-scroll h-full min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4"/);
  // No colour fade on the phone card: the page never shows through it.
  assert.match(ask, /'fixed inset-x-0 z-40 flex flex-col bg-popover'/);
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
  assert.match(core, /overflow-y-auto overscroll-y-contain/);
  assert.match(
    strip(read('v2', 'features', 'conversations', 'conversation', 'MessageList.tsx')),
    /overflow-y-auto overscroll-y-contain/,
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
  // The desktop breadcrumb is in the bar too, and truncates by CSS alone.
  for (const file of ['V2Header.tsx', 'V2Breadcrumb.tsx', 'TunedHeader.tsx', 'V2NotificationBell.tsx', 'V2HeaderMenu.tsx', 'HomeTabs.tsx', 'Logo.tsx']) {
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
    /\{isConversation \? \(\s*<button\s+type="button"\s+onClick=\{onBack\}\s+aria-label=\{`Back to your chats about this \$\{noun\}`\}\s+className=\{button\}\s*>[\s\S]*?<\/button>\s*\) : \(\s*<span aria-hidden className=\{target\} \/>\s*\)\}/,
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
  assert.match(ask, /<CaseChatBar\s+subject=\{subject\}\s+view=\{view\}\s+onBack=\{\(\) => onOpenChat\('new'\)\}\s+onClose=\{onClose\}\s+tall/);
  assert.match(screen, /onClose=\{closeChat\}/);
  assert.match(host, /const closeChat = useCallback\(\(\) => \{\s*setChat\(null\);/);
  assert.match(host, /setChat\(new URLSearchParams\(window\.location\.search\)\.get\('chat'\)\);/);
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
  assert.match(ask, /\{screenMounted \? \(\s*<div[\s\S]*?<CaseChatBar\s+subject=\{subject\}\s+view=\{view\}/);
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
    /return \(\) => \{\s*card\.style\.removeProperty\('--v2-case-chat-held-top'\);\s*card\.style\.removeProperty\('--v2-case-chat-held-height'\);\s*card\.style\.removeProperty\('--v2-case-chat-held-pad'\);\s*\};\s*\}, \[screenOpen, screenMounted\]\);$/,
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
  assert.match(host, /window\.setTimeout\(\(\) => setRenderedChat\(null\), 240\)/);
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
    /'fixed inset-x-0 z-40 flex flex-col bg-popover',\s*'data-\[state=closed\]:pointer-events-none data-\[state=closed\]:motion-safe:animate-out data-\[state=closed\]:motion-safe:fade-out data-\[state=closed\]:motion-safe:duration-200 data-\[state=closed\]:fill-mode-forwards data-\[state=closed\]:motion-reduce:invisible',/,
  );
  // Once: the panel slot inside has no exit of its own, only the opening fade.
  assert.equal(ask.match(/animate-out/g)?.length, 1);
  // Every browser but Chrome and Edge on iPhone (chromium-ios.test.ts).
  assert.match(ask, /: 'flex min-h-0 flex-1 flex-col [^']*motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200[^']*'\s*\}\s*>/);
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
    /\{screenMounted \? \(\s*<div\s+ref=\{slotRef\}\s+className=\{[\s\S]*?'flex min-h-0 flex-1 flex-col[\s\S]*?\) : panelMounted \? \([\s\S]*?\) : null\}\s*(?:\{\}\s*)?<CaseChatComposerDock\s+view=\{view\}/,
  );
  assert.equal(ask.match(/<CaseChatComposerDock/g)?.length, 1);
  const dock = ask.slice(ask.indexOf('<CaseChatComposerDock'), ask.indexOf('/>', ask.indexOf('<CaseChatComposerDock')));
  assert.doesNotMatch(dock, /\bkey=/);
  // The composer stays visible through a rise and rides iOS's pan (the techlead, 13
  // October 2026). Fading it with the bar and middle is a deliberate switch, so a
  // class on the dock that hides it fails here first.
  assert.doesNotMatch(dock, /opacity-0/);
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
  // The hold's own numbers (13 October 2026), so a recording shows when the card is
  // held, what iOS has reported against the card, and where the box and the canvas are.
  for (const line of ['t ', 'since focus ', 'vv.top+h ', 'card h ', 'held ', 'rising ', 'box ', 'html bg ', 'slot opacity ']) {
    assert.ok(readout.includes('`' + line), line);
  }
  // The time since a focus comes from the focusin listener, which is still one listener.
  assert.match(readout, /const onFocusIn = \(\): void => \{\s*focusedAt = performance\.now\(\);\s*change\(\);\s*\};/);
  // Never takes a tap, and reads no user data from the page (no field values, no text, no ids).
  assert.match(readout, /pointer-events-none fixed left-0/);
  assert.doesNotMatch(readout, /\.value\b|innerText|\.id\b|textContent\s*[^=\s]/);
});

/* Arthur's recordings of the open (12 October 2026): iOS reports the keyboard's end
 * geometry and pans the page for about 250 ms after it, so the card was drawn low with
 * the judgment above it and slid up. During a rise the card now covers from the
 * layout viewport's top, its bar and middle transparent, and takes the visible
 * geometry once, the bar and middle fading in.
 *
 * His recording of 13 October 2026 (cb54453): iOS sends those end values in two
 * events about 65 ms apart, a `resize` (height 462, offset 0) and then a `scroll`
 * (offset 390). The held height was their live sum, so the card was 852 tall, then
 * 462, then 852 again, and the composer at its bottom jumped up 390 pt and down
 * 346 pt. The held height is now a length, and the hold ends only once iOS's numbers
 * agree with the card. Every rise holds, not only the open's. */

/** The hold effect: one hold per rise of the keyboard while the phone chat is open. */
const openEffect = () => {
  const effect = ask.match(/useLayoutEffect\(\(\) => \{\s*const card = cardRef\.current;\s*if \(!screenOpen \|\| !card \|\| chromiumIOS\) return;\s*const viewport = window\.visualViewport;[\s\S]*?\}, \[screenOpen, chromiumIOS\]\);/)?.[0];
  assert.ok(effect, 'a layout effect on the open state holds the card while the keyboard rises');
  return effect;
};

test('a rise holds the card at the layout viewport, a length, until iOS reports a geometry that agrees', () => {
  const effect = openEffect();
  assert.match(ask, /const KEYBOARD_RISE_MS = 350;/);
  assert.match(ask, /const KEYBOARD_SETTLE_CAP_MS = 1000;/);
  // The tap that opens the chat starts one at once: a focus in the card's box. A
  // deep link focuses nothing.
  assert.match(
    effect,
    /const active = document\.activeElement;\s*if \(active instanceof HTMLTextAreaElement && card\.contains\(active\)\) hold\(active, true\);/,
  );
  // The writes: top at the layout viewport's top, height the layout viewport's.
  assert.match(
    effect,
    /card\.style\.setProperty\('--v2-case-chat-held-top', '0px'\);\s*card\.style\.setProperty\('--v2-case-chat-held-height', '100dvh'\);\s*if \(rising\) card\.setAttribute\('data-keyboard', 'rising'\);/,
  );
  // Never the live sum of the viewport variables: iOS sends them in two events 65 ms
  // apart, and the sum sized the card twice, 852 then 462 then 852 (Arthur's
  // recording, 13 October 2026).
  assert.doesNotMatch(ask, /calc\(var\(--visual-top/);
  // The release is gated on agreement: top plus height at the card's bottom, within
  // 1 px. At KEYBOARD_RISE_MS only if they agree, after it at the first viewport
  // event that makes them agree, and at the cap whatever they say.
  assert.match(
    effect,
    /Math\.abs\(published\('--visual-top'\) \+ published\('--visual-height'\) - card\.offsetHeight\) <= 1/,
  );
  assert.match(effect, /const onRisen = \(\): void => \{\s*risen = true;\s*if \(agrees\(\)\) release\(\);\s*\};/);
  assert.match(effect, /if \(risen && agrees\(\)\) release\(\);/);
  assert.match(effect, /riseTimer = window\.setTimeout\(onRisen, KEYBOARD_RISE_MS\);/);
  assert.match(effect, /capTimer = window\.setTimeout\(release, KEYBOARD_SETTLE_CAP_MS\);/);
  assert.equal(effect.match(/window\.setTimeout\(/g)?.length, 2, 'the rise and the cap, no other timer');
  // The numbers are read from the root's inline style, where the hook writes them.
  assert.match(effect, /parseFloat\(document\.documentElement\.style\.getPropertyValue\(name\)\)/);
  // Released: the held pair, the riding pad and the attribute go.
  assert.match(
    effect,
    /const release = \(\): void => \{\s*stop\(\);\s*card\.style\.removeProperty\('--v2-case-chat-held-top'\);\s*card\.style\.removeProperty\('--v2-case-chat-held-height'\);\s*card\.style\.removeProperty\('--v2-case-chat-held-pad'\);\s*\};/,
  );
  assert.match(
    effect,
    /const stop = \(\): void => \{\s*window\.clearTimeout\(riseTimer\);\s*window\.clearTimeout\(capTimer\);\s*box\.removeEventListener\('focusout', release\);\s*viewport\?\.removeEventListener\('resize', onViewport\);\s*viewport\?\.removeEventListener\('scroll', onViewport\);\s*card\.removeAttribute\('data-keyboard'\);\s*stopHold = null;\s*\};/,
  );
  assert.match(effect, /viewport\?\.addEventListener\('resize', onViewport\);\s*viewport\?\.addEventListener\('scroll', onViewport\);/);
  // Nothing goes through state, and the composer's node and focus are untouched.
  assert.doesNotMatch(effect, /(?<![.\w])set[A-Z]\w*\(|\.focus\(|\.blur\(/);
});

test('a later rise holds too: a focus of a box in the open card while the keyboard is down', () => {
  const effect = openEffect();
  // One focusin listener on the card for as long as the chat is open, removed with it.
  assert.match(effect, /card\.addEventListener\('focusin', onFocusIn\);/);
  assert.match(effect, /card\.removeEventListener\('focusin', onFocusIn\);/);
  // Only a textarea, only when no hold runs, only with the keyboard down: the
  // published top 0 and the published height the card's own.
  assert.match(
    effect,
    /const onFocusIn = \(event: FocusEvent\): void => \{\s*const box = event\.target;\s*if \(stopHold === null && box instanceof HTMLTextAreaElement && keyboardDown\(\)\) \{\s*hold\(box, false\);\s*\}\s*\};/,
  );
  assert.match(
    effect,
    /const keyboardDown = \(\): boolean =>\s*published\('--visual-top'\) === 0 &&\s*Math\.abs\(published\('--visual-height'\) - card\.offsetHeight\) <= 1;/,
  );
  assert.equal(effect.match(/(?<![\w.])hold\(/g)?.length, 2, 'the tap and the later focus');
  // Its bar and middle ride only from a viewport event that shows the keyboard
  // coming (more than 1 px of the card covered), and once per rise, so a focus that
  // raises none (a desktop window, Android's one resize, where the layout viewport
  // and 100dvh shrink together) changes nothing on screen.
  assert.match(
    effect,
    /const covered = card\.offsetHeight - published\('--visual-height'\);\s*if \(!riding && covered > 1\) ride\(covered\);/,
  );
  assert.equal(effect.match(/(?<![\w.])ride\(/g)?.length, 1, 'one call site');
  // A later rise that raises no keyboard sets no attribute at all.
  assert.match(effect, /if \(rising\) card\.setAttribute\('data-keyboard', 'rising'\);/);
  assert.match(effect, /if \(stopHold === null && box instanceof HTMLTextAreaElement && keyboardDown\(\)\) \{\s*hold\(box, false\);/);
});

test('the bar and middle ride the keyboard up: laid out in the visible band, one fade, nothing moves at the release', () => {
  const effect = openEffect();
  // The pad is the part of the held card the keyboard will cover; written with the
  // riding state and the one fade, which reduced motion skips.
  assert.match(
    effect,
    /const ride = \(pad: number\): void => \{\s*riding = true;\s*card\.style\.setProperty\('--v2-case-chat-held-pad', `\$\{pad\}px`\);\s*card\.setAttribute\('data-keyboard', 'riding'\);\s*const slot = slotRef\.current;\s*if \(!slot\) return;[\s\S]*?for \(const animation of slot\.getAnimations\(\)\) animation\.cancel\(\);\s*if \(!window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) \{\s*slot\.animate\(\[\{ opacity: 0 \}, \{ opacity: 1 \}\], \{\s*duration: SLOT_RIDE_FADE_MS,/,
  );
  assert.match(ask, /const SLOT_RIDE_FADE_MS = 200;/);
  assert.equal(ask.match(/\.animate\(/g)?.length, 1, 'the one scripted fade');
  // The pad has one writer (ride) and two removers, the release (every way a hold
  // ends: the rise, the cap, a blur, a width change) and the close effect's
  // cleanup; it is read once, by the card's padding.
  assert.equal(ask.match(/setProperty\('--v2-case-chat-held-pad'/g)?.length, 1);
  assert.equal(ask.match(/removeProperty\('--v2-case-chat-held-pad'\)/g)?.length, 2);
  assert.equal(ask.match(/var\(--v2-case-chat-held-pad,/g)?.length, 1);
  // While riding, the slot's CSS transition is off, so the scripted fade is the only
  // animation; its opacity is not touched at the release, so nothing fades there.
  assert.match(ask, /in-data-\[keyboard=riding\]:transition-none/);
  assert.doesNotMatch(ask, /in-data-\[keyboard=riding\]:opacity/);
  // Desktop xl is untouched: the hold runs only for the phone screen.
  assert.match(ask, /const screenOpen = screen && panelOpen;/);
  assert.match(effect, /^useLayoutEffect\(\(\) => \{\s*const card = cardRef\.current;\s*if \(!screenOpen \|\| !card \|\| chromiumIOS\) return;/);
  // The readout prints the pad.
  assert.match(detail('KeyboardDebugReadout.tsx'), /`pad \$\{heldPad \|\| 'none'\}`/);
});

test('the hold cut short by a blur of the box ends it at once, on the visible viewport', () => {
  const effect = openEffect();
  assert.match(effect, /box\.addEventListener\('focusout', release\);/);
  // `release` drops the held pair, so the card reads `--visual-top`/`--visual-height`,
  // which the keyboard hook keeps current as the keyboard goes down.
  assert.match(ask, /top: 'var\(--v2-case-chat-held-top, var\(--visual-top, 0px\)\)'/);
  assert.match(ask, /height: 'var\(--v2-case-chat-held-height, var\(--visual-height, 100dvh\)\)'/);
  // Until then the held height is a length, never a sum of the viewport variables:
  // the two events that arrive during a rise cannot move the card's bottom.
  assert.match(effect, /'--v2-case-chat-held-height', '100dvh'/);
  assert.doesNotMatch(effect, /var\(--visual-(top|height)/);
});

test('the hold cut short by a rotation or a width change ends it on the visible viewport', () => {
  const effect = openEffect();
  assert.match(effect, /const viewport = window\.visualViewport;/);
  assert.match(effect, /const width = viewport\?\.width;/);
  assert.match(effect, /if \(viewport\?\.width !== width\) \{\s*release\(\);\s*return;\s*\}/);
  // Width, not height: the keyboard's own rise changes the height (and in the
  // home-screen app innerHeight), which must not end the hold.
  assert.doesNotMatch(effect, /innerHeight|viewport\?\.height/);
});

test('a close during the hold leaves the held pair for the close effect, which freezes the card where it is', () => {
  const effect = openEffect();
  // The cleanup stops a running hold: the timers, the listeners and the attribute go,
  // the held pair stays. React runs a component's layout cleanups before its layout
  // effects, so the close effect then measures the card at its held geometry
  // (covering from the top) and writes that rect over the pair; its own cleanup drops
  // the pair.
  assert.match(
    effect,
    /return \(\) => \{\s*card\.removeEventListener\('focusin', onFocusIn\);\s*stopHold\?\.\(\);\s*\};\s*\}, \[screenOpen, chromiumIOS\]\);$/,
  );
  const stop = effect.match(/const stop = \(\): void => \{[\s\S]*?\n\s*\};/)?.[0];
  assert.ok(stop);
  assert.doesNotMatch(stop, /removeProperty/);
  const close = closeEffect();
  assert.match(close, /const rect = card\.getBoundingClientRect\(\);\s*card\.style\.setProperty\('--v2-case-chat-held-top', `\$\{rect\.top\}px`\);/);
  assert.match(close, /return \(\) => \{\s*card\.style\.removeProperty\('--v2-case-chat-held-top'\);\s*card\.style\.removeProperty\('--v2-case-chat-held-height'\);\s*card\.style\.removeProperty\('--v2-case-chat-held-pad'\);\s*\};/);
  // Every falling edge of screenOpen runs the close path, so a pair left on the card
  // never outlives the close: it is gone before any later open.
  assert.match(close, /const closed = wasScreenOpen\.current && !screenOpen;/);
});

test('the slot is transparent until iOS reports the keyboard, takes no tap during the hold, and fades in once; reduced motion, no fade', () => {
  assert.match(
    ask,
    /: 'flex min-h-0 flex-1 flex-col transition-opacity duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 motion-reduce:transition-none in-data-\[keyboard\]:pointer-events-none in-data-\[keyboard=rising\]:opacity-0 in-data-\[keyboard=riding\]:transition-none'\s*\}\s*>/,
  );
  // The deep link keeps the mount fade; nothing slides.
  assert.doesNotMatch(ask, /slide-in|slide-out/);
  // C' stays true: the composer's X and the hook's keyboard flag are gone.
  assert.doesNotMatch(ask, /v2-keyboard|editableFocused/);
});

test('while the phone chat is open the canvas is the card colour, and every way out puts it back', () => {
  // iOS's pan trails its keyboard by up to 110 pt on the rise and runs behind it on
  // Done, and the strip between them shows the canvas, the root's background: a dark
  // band under the composer (Arthur's recording, 13 October 2026). Set in `hide`,
  // the saved value put back in `restore`, so the pagehide/pageshow pair and the
  // effect's cleanup cover it with the bars.
  const chrome = chromeEffect();
  assert.match(chrome, /const root = document\.documentElement;/);
  assert.match(chrome, /const \{ backgroundColor \} = root\.style;/);
  assert.match(
    chrome,
    // The shell's full-height mark rides with it (case-chat-safari-clip.test.ts).
    /const hide = \(\): void => \{[\s\S]*?root\.style\.backgroundColor = 'var\(--popover\)';\s*root\.setAttribute\(CHAT_SCREEN_ATTR, ''\);\s*\};\s*const restore = \(\): void => \{[\s\S]*?root\.style\.backgroundColor = backgroundColor;\s*root\.removeAttribute\(CHAT_SCREEN_ATTR\);\s*\};/,
  );
  assert.equal(ask.match(/style\.backgroundColor =/g)?.length, 2, 'set once, restored once');
});

/* The no-pan probe (`?kbnopan=static|ride`) is gone (the techlead, 13 October 2026):
 * Arthur's recordings on an iPhone Xs Max showed iOS still panning the page with
 * either mode, and the card held above the screen. The kbdebug readout stays. */
test('the ?kbnopan= probe is removed, and the keyboard height it read is no longer published', () => {
  assert.deepEqual(sourcesMentioning('kbnopan'), []);
  assert.deepEqual(sourcesMentioning('--visual-keyboard'), []);
  assert.doesNotMatch(ask, /KeyboardProbe|holdForProbe|keyboardProbe/);
  assert.doesNotMatch(screen, /KeyboardProbe|keyboardProbe/);
  assert.match(screen, /const keyboardDebug = searchParams\.get\('kbdebug'\) === '1';/);
});
