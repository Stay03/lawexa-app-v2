import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FIND_ROOM_GAP, findCardRoom } from './find-room';

/* Lucy, 25 October 2026 (483b47b3, item 6): on a computer the draft's find
 * card covered the draft's first lines. While the card is open, the draft's
 * scroll area keeps the card's height plus a little air as top room, on a
 * computer only. TEST DATA throughout. */

const editor = () => readFileSync(new URL('./DraftEditor.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the room is the card’s height plus 8px of air, and none without a card', () => {
  assert.equal(FIND_ROOM_GAP, 8);
  // The find row alone, and with the replace row open.
  assert.equal(findCardRoom(44), 52);
  assert.equal(findCardRoom(84.4), 93);
  // Not measured yet, or gone.
  assert.equal(findCardRoom(0), 0);
  assert.equal(findCardRoom(-3), 0);
  assert.equal(findCardRoom(Number.NaN), 0);
});

test('the draft measures the open card and keeps that room above its text, on a computer only', () => {
  const source = editor();
  // The card is marked without a box of its own, so it is placed exactly as before.
  assert.match(source, /<div data-v2-draft-find className="contents">\s*<FindBar/);
  // Measured while the bar is open, as it changes (the replace row opens and closes).
  assert.match(source, /if \(!findOpen \|\| !card\) return;\s*const observer = new ResizeObserver/);
  assert.match(source, /return \(\) => observer\.disconnect\(\);\s*\}, \[findOpen\]\);/);
  // Closing the bar takes the room away.
  assert.match(source, /const findRoom = findOpen \? findCardRoom\(findCardHeight\) : 0;/);
  // xl only: on a phone the find bar is a strip in the flow and covers nothing.
  assert.match(
    source,
    /className="v2-quiet-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain xl:scroll-pt-\[var\(--v2-draft-find-room\)\] xl:pt-\[var\(--v2-draft-find-room\)\]"\s*style=\{\{ '--v2-draft-find-room': `\$\{findRoom\}px` \} as CSSProperties\}/,
  );
  // Every use of the room is behind xl:.
  const uses = source.split('pt-[var(--v2-draft-find-room)]').length - 1;
  const xlUses =
    source.split('xl:pt-[var(--v2-draft-find-room)]').length - 1 + source.split('xl:scroll-pt-[var(--v2-draft-find-room)]').length - 1;
  assert.equal(uses, 2);
  assert.equal(xlUses, uses);
});
