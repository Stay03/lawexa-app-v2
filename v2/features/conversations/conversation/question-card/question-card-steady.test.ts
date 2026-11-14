import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CARD_GAP_PX, CARD_MIN_HEIGHT_PX, heightWithBox } from './card-height';

/* Stay on live, 14 November 2026 (c91086ec 567b4719): "the page is jumpy and
 * buggy when i go from one option to type my answer", "when an option is
 * selected the question component is so much at the bottom", "I should be able
 * to go back to the previous question". TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
const here = ['v2', 'features', 'conversations', 'conversation', 'question-card'];

test('opening the box, the card gives back its height so the two stand where the card stood', () => {
  // A 420px card with the 12px gap under it, and an 80px box: the card becomes 352px; 352 + 80 = 420 + 12.
  assert.equal(heightWithBox(420, 80), 352);
  assert.equal(heightWithBox(420, 80) + 80, 420 + CARD_GAP_PX);
  // Never smaller than its header, a question and a row.
  assert.equal(heightWithBox(150, 120), CARD_MIN_HEIGHT_PX);
  assert.equal(CARD_GAP_PX, 12);
});

test('the card measures the folded box, locks its height while the box is open, and keeps the chosen row in view', () => {
  const card = read(...here, 'QuestionDock.tsx');
  assert.match(card, /const fold = card\?\.parentElement\?\.querySelector<HTMLElement>\(':scope > \[data-card-box-folded\] > div'\);/);
  assert.match(card, /return heightWithBox\(card\.getBoundingClientRect\(\)\.height, fold\.scrollHeight\);/);
  // Measured only when the box opens; kept while it answers; dropped when it folds.
  assert.match(card, /const lock = boxState === null \? null : answering \? boxHeightLock : measuredLock\(\);/);
  assert.match(card, /flushSync\(\(\) => \{\s*setBoxHeightLock\(lock\);\s*onBoxAnswering\(boxState\);\s*\}\);/);
  assert.match(card, /style=\{ownChosen && boxHeightLock !== null \? \{ height: boxHeightLock \} : undefined\}/);
  assert.match(card, /if \(lock !== null && listRef\.current\) listRef\.current\.scrollTop = listRef\.current\.scrollHeight;/);
  // The scrolled choices fade at the top, so a row part-way out never reads as cut text.
  assert.match(card, /ownChosen && boxHeightLock !== null && SCROLL_TOP_FADE,/);
  assert.match(card, /const SCROLL_TOP_FADE = '\[mask-image:linear-gradient\(to_bottom,transparent,black_20px\)\]';/);
  // The box opens in the same frame (no 200ms fold to push the two apart), and focusing it scrolls nothing.
  assert.doesNotMatch(read(...here, 'CardBoxFold.tsx'), /transition-\[grid-template-rows/);
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
  assert.match(card, /\{index > 0 \? \(\s*<button\s+type="button"\s+disabled=\{locked\}\s+onClick=\{\(\) => goTo\(index - 1\)\}/);
  assert.match(card, /<ChevronLeft aria-hidden className="size-4" \/>\s*Back/);
  // The answers live per question in `drafts`, which goTo leaves alone.
  assert.match(card, /const goTo = \(at: number, current: readonly \(QuestionCardAnswer \| null\)\[\] = drafts\) => \{/);
});
