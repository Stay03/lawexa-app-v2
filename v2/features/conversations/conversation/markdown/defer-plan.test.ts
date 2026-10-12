import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFER_ABOVE_BLOCKS,
  EAGER_MIN_BLOCKS,
  EAGER_MIN_CHARS,
  SWAP_DEADLINE_MS,
  eagerStart,
  openDefersBlocks,
  scheduleSwap,
  type FrameTimers,
} from './defer-plan';

const block = (chars: number) => 'x'.repeat(chars);
const atBottom = { streaming: false, landsAtBottom: true };

test('an answer of the threshold or fewer blocks parses whole', () => {
  assert.equal(eagerStart(Array.from({ length: DEFER_ABOVE_BLOCKS }, () => block(2_000)), atBottom), 0);
  assert.ok(eagerStart(Array.from({ length: DEFER_ABOVE_BLOCKS + 1 }, () => block(2_000)), atBottom) > 0);
});

test('the eager blocks are the last ones, at least the minimum count when blocks are long', () => {
  const blocks = Array.from({ length: 20 }, () => block(2_000));
  assert.equal(eagerStart(blocks, atBottom), 20 - EAGER_MIN_BLOCKS);
});

test('the eager blocks reach the character minimum when blocks are short', () => {
  const blocks = Array.from({ length: 40 }, () => block(100));
  const from = eagerStart(blocks, atBottom);
  const eager = blocks.slice(from);
  assert.equal(eager.join('').length, EAGER_MIN_CHARS);
  assert.ok(eager.length >= EAGER_MIN_BLOCKS);
  // One block fewer would be short of the characters.
  assert.ok(blocks.slice(from + 1).join('').length < EAGER_MIN_CHARS);
});

test('an answer whose whole text is under the character minimum defers nothing', () => {
  assert.equal(eagerStart(Array.from({ length: 12 }, () => block(100)), atBottom), 0);
});

test('nothing defers while streaming or when the open does not land at the bottom', () => {
  const blocks = Array.from({ length: 20 }, () => block(2_000));
  assert.equal(eagerStart(blocks, { streaming: true, landsAtBottom: true }), 0);
  assert.equal(eagerStart(blocks, { streaming: false, landsAtBottom: false }), 0);
});

test('a row defers only during the open, at the bottom, with no turn running', () => {
  assert.equal(openDefersBlocks({ opened: false, scrolledUp: false, turnRunning: false }), true);
  // Mounted after the open (a reasoning trace opened by hand, a message from another tab).
  assert.equal(openDefersBlocks({ opened: true, scrolledUp: false, turnRunning: false }), false);
  // The reader left the bottom before the row mounted.
  assert.equal(openDefersBlocks({ opened: false, scrolledUp: true, turnRunning: false }), false);
  // Opened mid-turn: a live handover body has no `animate` to say it streams.
  assert.equal(openDefersBlocks({ opened: false, scrolledUp: false, turnRunning: true }), false);
});

/** Frames and timers driven by hand. */
function fakeTimers() {
  let nextId = 1;
  const frames = new Map<number, () => void>();
  const timeouts = new Map<number, { run: () => void; ms: number }>();
  const timers: FrameTimers = {
    requestAnimationFrame: (run) => {
      frames.set(nextId, run);
      return nextId++;
    },
    cancelAnimationFrame: (id) => void frames.delete(id),
    setTimeout: (run, ms) => {
      timeouts.set(nextId, { run, ms });
      return nextId++;
    },
    clearTimeout: (id) => void timeouts.delete(id),
  };
  const frame = () => {
    const due = [...frames.values()];
    frames.clear();
    due.forEach((run) => run());
  };
  const elapse = () => {
    const due = [...timeouts.values()];
    timeouts.clear();
    due.forEach(({ run }) => run());
  };
  return { timers, frames, timeouts, frame, elapse };
}

test('the swap is asked for two frames after mount, and the 1 s deadline starts then', () => {
  const clock = fakeTimers();
  const swaps: boolean[] = [];
  scheduleSwap(clock.timers, (urgent) => swaps.push(urgent));
  clock.frame();
  assert.deepEqual(swaps, []);
  assert.equal(clock.timeouts.size, 0);
  clock.frame();
  assert.deepEqual(swaps, [false]);
  assert.deepEqual([...clock.timeouts.values()].map((t) => t.ms), [SWAP_DEADLINE_MS]);
  assert.equal(SWAP_DEADLINE_MS, 1_000);
  // The transition has not committed by the deadline: the urgent swap.
  clock.elapse();
  assert.deepEqual(swaps, [false, true]);
});

test('cancelling after the swap commits drops the deadline; cancelling early drops everything', () => {
  const committed = fakeTimers();
  const swaps: boolean[] = [];
  const cancel = scheduleSwap(committed.timers, (urgent) => swaps.push(urgent));
  committed.frame();
  committed.frame();
  cancel();
  committed.elapse();
  assert.deepEqual(swaps, [false]);

  const early = fakeTimers();
  const none: boolean[] = [];
  scheduleSwap(early.timers, (urgent) => none.push(urgent))();
  early.frame();
  early.frame();
  early.elapse();
  assert.deepEqual(none, []);
  assert.equal(early.frames.size, 0);
});

// Rendering cannot run under node:test. These pin the wiring that has to hold
// together with the plan above.
const here = dirname(fileURLToPath(import.meta.url));
const markdownText = readFileSync(join(here, 'MarkdownText.tsx'), 'utf8');
const messageList = readFileSync(join(here, '..', 'MessageList.tsx'), 'utf8');

test('MarkdownText reads the plan once at mount, and streaming or no list means none', () => {
  assert.match(markdownText, /import \{ splitMarkdownBlocks \} from '\.\/split-blocks';/);
  assert.doesNotMatch(markdownText, /function splitMarkdownBlocks/);
  assert.match(markdownText, /const keep = useContext\(ScrollKeepContext\);/);
  // An answer whose blocks are all kept defers none (prepared-blocks.test.ts).
  assert.match(
    markdownText,
    /eagerFrom:\s*keep && !blocks\.every\(\(block\) => preparedBlocks\.has\(block\)\)\s*\? eagerStart\(blocks, \{ streaming: animate \|\| content === '', landsAtBottom: keep\.landsAtBottom \}\)\s*: 0,/,
  );
  assert.match(markdownText, /swapped \|\| animate \|\| plan\.content !== content \? 0 : Math\.min\(plan\.eagerFrom, blocks\.length\)/);
  assert.match(markdownText, /index < pendingCount \? \(\s*<PendingBlock key=\{index\} content=\{block\} \/>/);
  assert.match(markdownText, /<p className="v2-md-pending">\{content\}<\/p>/);
});

test('MarkdownText swaps in a transition, urgently at the deadline, and corrects only without anchoring', () => {
  assert.match(markdownText, /return scheduleSwap\(BROWSER_FRAMES, \(urgent\) => \{/);
  assert.match(markdownText, /if \(urgent\) setSwapped\(true\);\s*else startTransition\(\(\) => setSwapped\(true\)\);/);
  assert.match(markdownText, /if \(!anchoring && scroller && container\) \{/);
  assert.match(markdownText, /useLayoutEffect\(\(\) => \{\s*if \(!swapped\) return;/);
  assert.match(markdownText, /if \(fix !== 0\) keepPlace\(fix\);/);
});

test('MessageList provides the scroller, the bottom and the open to the answers', () => {
  assert.match(messageList, /<ScrollKeepContext\.Provider value=\{scrollKeep\}>/);
  assert.match(
    messageList,
    /scrollerRef: scrollRef,\s*atBottomRef,\s*anchoring: canAnchor,\s*landsAtBottom,\s*keepPlace: \(fix\) => \{/,
  );
  assert.match(
    messageList,
    /if \(fix === 'bottom'\) el\.scrollTop = el\.scrollHeight;\s*else el\.scrollTop \+= fix;\s*\},\s*\}\),\s*\[canAnchor, landsAtBottom\],/,
  );
  assert.match(
    messageList,
    /openDefersBlocks\(\{\s*opened,\s*scrolledUp: detachedAt !== null,\s*turnRunning: isStreaming,\s*\}\)/,
  );
  assert.match(
    messageList,
    /if \(!showAll \|\| !hasMessages\) return;\s*const frame = requestAnimationFrame\(\(\) => setOpened\(true\)\);/,
  );
});
