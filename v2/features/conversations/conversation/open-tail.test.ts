import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guard for "move first, fill second" in MessageList.tsx. Rendering cannot run
// under node:test; the live before/after table is in the commit. This pins the
// three parts that have to hold together.
const here = dirname(fileURLToPath(import.meta.url));
const list = readFileSync(join(here, 'MessageList.tsx'), 'utf8');

const constant = (name: string) =>
  Number(new RegExp(`const ${name} = ([\\d_]+);`).exec(list)?.[1]?.replace(/_/g, ''));

test('an open draws the newest messages first, the rest after the first painted frame', () => {
  assert.match(list, /messages: latestMessages,/);
  // The newest messages within OPEN_TAIL, cut at a group's start (open-tail.ts,
  // pinned in open-tail-split.test.ts); it was a plain slice(-OPEN_TAIL_MESSAGES).
  assert.match(list, /const openTail = useMemo\(\(\) => splitOpenTail\(latestMessages, OPEN_TAIL\), \[latestMessages\]\);/);
  assert.match(list, /const messages = showAll \? latestMessages : openTail\.newest;/);
  // Two animation frames, so the opening frame is painted before the rest draws,
  // and a transition, so drawing the rest can be interrupted.
  assert.match(list, /requestAnimationFrame\(\(\) => \{\s*second = requestAnimationFrame\(\(\) => startTransition\(\(\) => setShowAll\(true\)\)\);/);
  // Not useDeferredValue: inside a navigation (a transition) it returns the
  // full list at once.
  assert.doesNotMatch(list, /useDeferredValue\(/);
});

test('a cold open draws the newest first too: the two frames count from the first messages', () => {
  assert.match(
    list,
    /useEffect\(\(\) => \{\s*\/\/[^\n]*\n\s*if \(!hasMessages\) return;[\s\S]*?setShowAll\(true\)[\s\S]*?\}, \[hasMessages\]\);/,
  );
  // A chat with messages left to fill in sits at the bottom, so the older
  // messages filling in above never move the text the reader is looking at;
  // a chat drawn whole in its first frame keeps its layout.
  assert.match(list, /const anchorBottom = openTail\.older\.length > 0;/);
  assert.match(list, /anchorBottom && 'min-h-full justify-end'/);
});

test('the first scroll lands at the bottom before the browser paints', () => {
  assert.match(
    list,
    /useIsomorphicLayoutEffect\(\(\) => \{\s*if \(didInitialScrollRef\.current \|\| messages\.length === 0\) return;[\s\S]*?el\.scrollTop = el\.scrollHeight;\s*\}, \[messages\.length\]\);/,
  );
});

test('the first frame is a text budget of about two phone screens, and at most eight messages', () => {
  assert.equal(constant('OPEN_TAIL_MESSAGES'), 8);
  assert.equal(constant('OPEN_TAIL_CHARS'), 3_000);
  assert.match(list, /const OPEN_TAIL: OpenTailLimit = \{ messages: OPEN_TAIL_MESSAGES, chars: OPEN_TAIL_CHARS \};/);
});

test('a reader at the bottom stays there when the rest of the chat arrives', () => {
  assert.match(
    list,
    /useIsomorphicLayoutEffect\(\(\) => \{\s*const el = scrollRef\.current;\s*if \(!el \|\| !didInitialScrollRef\.current \|\| !atBottomRef\.current\) return;\s*el\.scrollTop = el\.scrollHeight;\s*\}, \[messages\.length\]\);/,
  );
});
