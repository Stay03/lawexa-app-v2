import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CARD_GAP_PX, STACK_MAX_HEIGHT, lockSurvivesResize } from './card-height';

/* Stay on live, 14 November 2026 (c91086ec 567b4719): "the page is jumpy and
 * buggy when i go from one option to type my answer", "when an option is
 * selected the question component is so much at the bottom", "I should be able
 * to go back to the previous question". TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const here = ['v2', 'features', 'conversations', 'conversation', 'question-card'];

test('the stack lock holds while the keyboard opens and lets go when the phone turns', () => {
  // A keyboard opening changes the height alone: the lock stays.
  assert.equal(lockSurvivesResize({ width: 360, height: 740 }, { width: 360, height: 420 }), true);
  // A turn of the phone changes the width: the card is a different shape, the lock goes.
  assert.equal(lockSurvivesResize({ width: 360, height: 740 }, { width: 740, height: 360 }), false);
  // Sub-pixel noise is not a turn.
  assert.equal(lockSurvivesResize({ width: 360.2, height: 740 }, { width: 359.8, height: 700 }), true);
  assert.equal(CARD_GAP_PX, 12);
});

test('opening the box, the stack keeps its height and the card gives the box what it takes; nothing else is measured', () => {
  const card = read(...here, 'QuestionDock.tsx');
  // Fable's review of abe2948c: the stack (card and box) is measured, once, as the box opens; the box never is.
  assert.doesNotMatch(card, /data-card-box-folded|heightWithBox|boxHeightLock|measuredLock/);
  assert.match(card, /const opening = boxState !== null && !answering;/);
  assert.match(card, /const height = opening \? \(stack\.current\?\.getBoundingClientRect\(\)\.height \?\? null\) : null;/);
  assert.match(card, /flushSync\(\(\) => \{\s*if \(opening && height !== null\) onStackLock\(height\);\s*if \(boxState === null\) onStackLock\(null\);\s*onBoxAnswering\(boxState\);\s*\}\);/);
  // The card is flex-1 and min-h-0 inside the locked stack, so the box's growth comes out of the card.
  assert.match(card, /const boxRoom = ownChosen && stackLocked;/);
  // Held, the stack is the card's one cap; alone, the card caps itself at 60dvh.
  assert.match(card, /boxRoom \? 'min-h-0 flex-1' : 'max-h-\[60dvh\]',/);
  // Fable's second review. 1: the held stack's ceiling follows the visible screen (a keyboard shrinks it).
  // Third review: the overlay keyboard (iOS Safari) keeps dvh full and reports --keyboard-inset, as the shell uses.
  assert.equal(STACK_MAX_HEIGHT, 'calc(100dvh - var(--keyboard-inset, 0px) - 7rem)');
  assert.match(read('v2', 'shell', 'shell.css'), /height: calc\(100dvh - var\(--keyboard-inset, 0px\)\);/);
  // For the same card the lock only grows, so a growth cut by the ceiling never shortens it for later.
  assert.match(read(...here, 'use-card-box.ts'), /current !== null && current\.card === card \? \{ card, height: Math\.max\(current\.height, height\) \} : \{ card, height \}/);
  // The chosen row alone in view takes no fade over its top.
  assert.match(card, /list\.toggleAttribute\('data-row-only', list\.clientHeight <= rowRoom \+ 1\);/);
  assert.match(card, /boxRoom && 'data-\[row-only\]:\[mask-image:none\]',/);
  assert.match(read(...here, 'use-card-box.ts'), /\{ height: stackLock, maxHeight: STACK_MAX_HEIGHT \}/);
  // 2: the shortfall counts the card's own overflow, and the card is watched too.
  assert.match(card, /const short = Math\.max\(rowRoom - list\.clientHeight, 0\) \+ \(card\.scrollHeight - card\.clientHeight\);/);
  assert.match(card, /if \(cardRef\.current\) watch\.observe\(cardRef\.current\);/);
  // 3: an observer's growth commits before paint.
  assert.match(card, /if \(fromObserver\) flushSync\(grow\);\s*else grow\(\);/);
  // 4: the row is scrolled into view, nearest edge, not to the bottom (a refused line sits under it).
  assert.match(card, /showRow\(list, row\);/);
  assert.doesNotMatch(card, /list\.scrollTop = list\.scrollHeight;/);
  // 5: a card that closes takes its answering box and its lock with it.
  assert.match(read(...here, 'use-card-box.ts'), /if \(card === null && \(state !== null \|\| lock !== null\)\) \{\s*setState\(null\);\s*setLock\(null\);\s*\}/);
  // The chosen row stays in view, after the question changes too (Back to an own-answered question),
  // and the card never gives it up: when the choices have less room than that row needs, the stack
  // grows by exactly the shortfall (Back from a shorter question; the fixture's case 3).
  assert.match(card, /const rowRoom = row\.offsetHeight \+ parseFloat\(style\.paddingTop\) \+ parseFloat\(style\.paddingBottom\);/);
  assert.match(card, /const grow = \(\) => onStackLock\(Math\.ceil\(height \+ short\)\);/);
  assert.match(card, /const watch = new ResizeObserver\(\(\) => keepChosenRow\(true\)\);\s*watch\.observe\(list\);/);
  // The choices drop their hints while the box is open, so they fit; any that still scroll fade at the top.
  assert.match(card, /\{option\.description && !boxRoom && \(/);
  assert.match(card, /boxRoom && SCROLL_TOP_FADE,/);
  assert.match(card, /const SCROLL_TOP_FADE = '\[mask-image:linear-gradient\(to_bottom,transparent,black_20px\)\]';/);
  // The lock: per card, dropped by a turn of the phone.
  const hook = read(...here, 'use-card-box.ts');
  assert.match(hook, /const stackStyle: CSSProperties \| undefined =\s*stackLock !== null \? \{ height: stackLock, maxHeight: STACK_MAX_HEIGHT \} : undefined;/);
  assert.match(hook, /if \(!lockSurvivesResize\(size, next\)\) setLock\(null\);/);
  // Both hosts wrap the card and the box in the one stack.
  for (const host of [read('v2', 'features', 'conversations', 'conversation', 'ChatDock.tsx'), read('v2', 'features', 'cases', 'detail', 'CaseChatCore.tsx')]) {
    assert.match(host, /<div ref=\{cardStack\} style=\{cardBox\.stackStyle\} className="flex flex-col">\s*\{openCard (?:&& surface )?&& \(\s*<QuestionDock/);
    assert.match(host, /stack=\{cardStack\}\s*onStackLock=\{cardBox\.onStackLock\}\s*stackLocked=\{cardBox\.stackLocked\}/);
  }
  // The box opens in the same frame (no 200ms fold to push the two apart), and focusing it scrolls nothing.
  const fold = read(...here, 'CardBoxFold.tsx');
  assert.doesNotMatch(fold, /transition-\[grid-template-rows/);
  assert.match(fold, /'grid shrink-0'/);
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'), /focus: \(\) => rootRef\.current\?\.querySelector\('textarea'\)\?\.focus\(\{ preventScroll: true \}\),/);
});

test('folded, the card keeps the space under it the box has, so it sits where the box sits', () => {
  const card = read(...here, 'QuestionDock.tsx');
  assert.match(card, /ownChosen \? 'rounded-t-3xl border-b-0' : 'mb-3 rounded-3xl',/);
  // mb-3 is the box's pb-3: 12px.
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'), /'relative w-full px-4 pb-3'/);
});

test('from the second question on, Back goes to the one before, its answer kept', () => {
  const card = read(...here, 'QuestionDock.tsx');
  assert.match(card, /\{index > 0 \? \(\s*<button\s+type="button"\s+disabled=\{locked\}\s+onClick=\{\(\) => \{[^}]*?goTo\(index - 1\);/);
  assert.match(card, /<ChevronLeft aria-hidden className="size-4" \/>\s*Back/);
  // The answers live per question in `drafts`, which goTo leaves alone.
  assert.match(card, /const goTo = \(at: number, current: readonly \(QuestionCardAnswer \| null\)\[\] = drafts\) => \{/);
  // Back to the first question takes the Back button away: the focus goes to the question (Fable's review).
  assert.match(card, /if \(index - 1 === 0\) window\.requestAnimationFrame\(\(\) => questionRef\.current\?\.focus\(\{ preventScroll: true \}\)\);/);
  assert.match(card, /<p ref=\{questionRef\} tabIndex=\{-1\}/);
});
