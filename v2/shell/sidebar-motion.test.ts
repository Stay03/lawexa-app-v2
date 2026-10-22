import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/* Stay, 22 October 2026: "The left sidebar doesn't feel very smooth when
 * opening and closing I need a smooth, satisfying motion". Motion cannot run
 * under node:test; these pin the numbers, the curves and the scoping, so a
 * change to any of them fails here and not on his phone. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const css = read('v2', 'shell', 'shell.css');
const drawer = read('v2', 'shell', 'V2Drawer.tsx');
const sheet = read('components', 'ui', 'sheet.tsx');

const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

/** The text from `from` up to (not including) the next `to`. */
const between = (source: string, from: string, to: string): string => {
  const start = source.indexOf(from);
  assert.ok(start >= 0, from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(end > start, to);
  return source.slice(start, end);
};

/** The `animation` shorthand the rule for `selector` sets inside `source`. */
const animationOf = (source: string, selector: string): string => {
  const block = between(source, selector, '}');
  const match = block.match(/animation: ([^;]+);/);
  assert.ok(match, `${selector} sets an animation`);
  return match[1];
};

const drawerCss = between(css, 'THE NAVIGATION DRAWER SLIDES', 'THE COMPUTER RAIL SLIDES');
const motion = between(drawerCss, '@media (prefers-reduced-motion: no-preference)', '@media (prefers-reduced-motion: reduce)');
const reduced = drawerCss.slice(drawerCss.indexOf('@media (prefers-reduced-motion: reduce)'));

test('the drawer panel slides its whole width and the scrim fades, on one clock and one curve each way', () => {
  const panelOpen = animationOf(motion, "html.v2-document-lock .v2-drawer[data-state='open']");
  const scrimOpen = animationOf(motion, "html.v2-document-lock .v2-drawer-scrim[data-state='open']");
  assert.equal(panelOpen, `v2-drawer-in 280ms ${EASE_OUT}`);
  assert.equal(scrimOpen, `v2-drawer-fade-in 280ms ${EASE_OUT}`);
  const panelClosed = animationOf(motion, "html.v2-document-lock .v2-drawer[data-state='closed']");
  const scrimClosed = animationOf(motion, "html.v2-document-lock .v2-drawer-scrim[data-state='closed']");
  assert.equal(panelClosed, `v2-drawer-out 220ms ${EASE_IN} forwards`);
  assert.equal(scrimClosed, `v2-drawer-fade-out 220ms ${EASE_IN} forwards`);
  // The same timing on both elements, so the panel and the scrim never part.
  assert.equal(panelOpen.replace('v2-drawer-in', ''), scrimOpen.replace('v2-drawer-fade-in', ''));
  assert.equal(panelClosed.replace('v2-drawer-out', ''), scrimClosed.replace('v2-drawer-fade-out', ''));
});

test('the panel keyframes move and never fade; the scrim keyframes fade and never move', () => {
  const slideIn = between(motion, '@keyframes v2-drawer-in', '@keyframes v2-drawer-out');
  const slideOut = between(motion, '@keyframes v2-drawer-out', 'html.v2-document-lock');
  assert.match(slideIn, /from \{\s*transform: translate3d\(-100%, 0, 0\);\s*\}/);
  assert.match(slideOut, /to \{\s*transform: translate3d\(-100%, 0, 0\);\s*\}/);
  assert.doesNotMatch(slideIn + slideOut, /opacity/);
  const fadeIn = between(drawerCss, '@keyframes v2-drawer-fade-in', '@keyframes v2-drawer-fade-out');
  const fadeOut = between(drawerCss, '@keyframes v2-drawer-fade-out', 'html.v2-document-lock');
  assert.match(fadeIn, /from \{\s*opacity: 0;\s*\}/);
  assert.match(fadeOut, /to \{\s*opacity: 0;\s*\}/);
  assert.doesNotMatch(fadeIn + fadeOut, /transform/);
  // Nothing in the drawer's motion lays out: transform and opacity only.
  assert.doesNotMatch(drawerCss, /\b(left|width|height|margin|padding):/);
});

test('nothing blurs behind the drawer', () => {
  assert.match(drawerCss, /html\.v2-document-lock \.v2-drawer-scrim \{\s*-webkit-backdrop-filter: none;\s*backdrop-filter: none;\s*\}/);
});

test('under reduced motion both fade over 120 ms and nothing slides', () => {
  assert.match(reduced, /html\.v2-document-lock \.v2-drawer\[data-state='open'\],\s*html\.v2-document-lock \.v2-drawer-scrim\[data-state='open'\] \{\s*animation: v2-drawer-fade-in 120ms ease-out;\s*\}/);
  assert.match(reduced, /html\.v2-document-lock \.v2-drawer\[data-state='closed'\],\s*html\.v2-document-lock \.v2-drawer-scrim\[data-state='closed'\] \{\s*animation: v2-drawer-fade-out 120ms ease-in forwards;\s*\}/);
  assert.doesNotMatch(reduced, /translate|v2-drawer-in|v2-drawer-out/);
  // The slide exists only where motion is welcome.
  assert.ok(motion.includes('@keyframes v2-drawer-in'));
});

const sidebar = read('components', 'ui', 'sidebar.tsx');
// The rules alone, after the block's comment (which names the linear move it replaces).
const railCss = between(css, 'THE COMPUTER RAIL SLIDES', 'A DEFERRED ANSWER BLOCK').replace(/^[\s\S]*?\*\//, '');
const railMotion = railCss.slice(0, railCss.indexOf('@media (prefers-reduced-motion: reduce)'));
const railReduced = railCss.slice(railCss.indexOf('@media (prefers-reduced-motion: reduce)'));
const GAP = "html.v2-document-lock [data-slot='sidebar'][data-side='left'] > [data-slot='sidebar-gap'] {";
const PANEL = "html.v2-document-lock [data-slot='sidebar'][data-side='left'] > [data-slot='sidebar-container'] {";
const COLLAPSED = "html.v2-document-lock [data-slot='sidebar'][data-side='left'][data-collapsible='offExamples'] > [data-slot='sidebar-container'] {";

test('the computer rail moves by transform and its gap by width, on one 260 ms ease-out, with no linear easing', () => {
  assert.match(between(railMotion, GAP, '}'), new RegExp(`transition: width 260ms ${EASE_OUT.replace(/[().]/g, '\\$&')};`));
  assert.match(between(railMotion, PANEL, '}'), new RegExp(`left: 0;\\s*transition: transform 260ms ${EASE_OUT.replace(/[().]/g, '\\$&')};`));
  assert.match(between(railMotion, COLLAPSED, '}'), /transform: translate3d\(-100%, 0, 0\);/);
  assert.doesNotMatch(railMotion, /linear|transition: left|transition-property/);
  // The gap's width is the one layout the move keeps: the rail still pushes the content.
  assert.doesNotMatch(railMotion, /position: absolute|z-index/);
});

test('under reduced motion the rail fades in place over 120 ms and the gap snaps', () => {
  assert.match(between(railReduced, GAP, '}'), /transition: none;/);
  assert.match(between(railReduced, PANEL, '}'), /transition: opacity 120ms ease-out, transform 0s;/);
  assert.match(between(railReduced, COLLAPSED, '}'), /opacity: 0;\s*transition: opacity 120ms ease-in, transform 0s linear 120ms;/);
  assert.doesNotMatch(railReduced, /260ms|cubic-bezier/);
});

test('the rail rules key on the primitive\'s own slots and the primitive keeps its stock move for v1', () => {
  assert.match(sidebar, /data-slot="sidebar-gap"/);
  assert.match(sidebar, /data-slot="sidebar-container"/);
  assert.match(sidebar, /data-collapsible=\{state === "collapsed" \? collapsible : ""\}/);
  assert.match(sidebar, /data-side=\{side\}\s*data-slot="sidebar"/);
  assert.match(sidebar, /"transition-\[width\] duration-200 ease-linear relative w-\(--sidebar-width\) bg-transparent"/);
  assert.match(sidebar, /transition-\[left,right,width\] duration-200 ease-linear md:flex/);
  assert.match(sidebar, /"left-0 group-data-\[collapsible=offExamples\]:left-\[calc\(var\(--sidebar-width\)\*-1\)\]"/);
  // The v2 rail is the off-canvas kind these rules move.
  assert.match(read('v2', 'shell', 'V2Sidebar.tsx'), /<Sidebar\s*collapsible="offExamples"/);
});

test('the rules reach the drawer alone: its two classes, and the sheet primitive is as it was for every other sheet', () => {
  assert.match(drawer, /className="v2-drawer gap-0 p-0 data-\[side=left\]:w-\[min\(85%,360px\)\] data-\[side=left\]:max-w-none data-\[side=left\]:sm:max-w-none"\s*overlayClassName="v2-drawer-scrim"/);
  // The overlay is the content's sibling in the portal, so the sheet threads a class to it. Nothing else changed.
  assert.match(sheet, /overlayClassName\?: string/);
  assert.match(sheet, /\{showOverlay && <SheetOverlay className=\{overlayClassName\} \/>\}/);
  assert.match(sheet, /className=\{cn\("data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black\/80 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50", className\)\}/);
  assert.match(sheet, /className=\{cn\("bg-background data-open:animate-in data-closed:animate-out data-\[side=right\]:data-closed:slide-out-to-right-10 [^"]*data-\[side=right\]:sm:max-w-sm outline-none", className\)\}/);
  // No other sheet wears the classes: the space drawer, the other left sheet, keeps the stock motion.
  const wearers: string[] = [];
  for (const dir of ['app', 'components', 'v2']) {
    for (const file of readdirSync(join(process.cwd(), dir), { recursive: true, encoding: 'utf8' })) {
      if (/\.tsx$/.test(file) && /v2-drawer/.test(read(dir, file))) wearers.push(join(dir, file));
    }
  }
  assert.deepEqual(wearers, [join('v2', 'shell', 'V2Drawer.tsx')]);
});
