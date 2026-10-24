import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* An inner scroller that is not positioned lets its absolutely placed children
 * (sr-only text, badges) take a containing block outside it: they escape its
 * clipping and make the next scroll container out grow. The chat transcript did
 * that (a space chat's author lines made the shell region scrollable, real-server
 * pass 10, 13 October 2026). The same build was found in four more places by a
 * sweep; each scroller is now `relative`, pinned here. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const SCROLLERS: ReadonlyArray<[string[], string]> = [
  [
    ['v2', 'features', 'conversations', 'conversation', 'MessageList.tsx'],
    'className="v2-quiet-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain"',
  ],
  // The folder picker's list, inside a dialog that scrolls (its drillable rows' sr-only hint).
  [
    ['v2', 'features', 'folders', 'picker', 'PickerBody.tsx'],
    'className="relative -mx-1 max-h-[min(24rem,45dvh)] min-h-0 overflow-y-auto overscroll-y-contain px-1"',
  ],
  // "Move to space": the rows' sr-only "In it now" on a phone.
  [
    ['v2', 'features', 'spaces', 'move', 'MoveToSpaceDialog.tsx'],
    "'relative -mx-2 max-h-[min(22rem,55vh)] overflow-y-auto overscroll-y-contain',",
  ],
  // A channel's feed: the empty channel's intro sr-only visibility label.
  [
    ['v2', 'features', 'channels', 'feed', 'ChannelFeed.tsx'],
    'className="v2-quiet-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain"',
  ],
  // The space pane: lobby and content rows carry sr-only text.
  [
    ['v2', 'features', 'collab', 'shell', 'CollabFrame.tsx'],
    'className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain"',
  ],
];

test('every inner scroller with absolutely placed children is a containing block', () => {
  for (const [path, className] of SCROLLERS) {
    assert.ok(read(...path).includes(className), `${path.join('/')} keeps its scroller positioned`);
  }
});

/* The quiet bar's reveal is an inherited property switched on the scroller, so
 * every switch restyles everything inside it (598 elements in a long chat,
 * chat reopen fix, 16 October 2026). On a touch screen `:hover` sticks and
 * `:active` holds under a finger, so the reveal lives only under a fine pointer
 * that can hover. */
test('the quiet scrollbar reveals only where a mouse can hover', () => {
  const css = read('v2', 'shell', 'shell.css');
  const reveal = /\.v2-quiet-scroll:hover,\s*\.v2-quiet-scroll:focus-within,\s*\.v2-quiet-scroll:active \{\s*scrollbar-color: var\(--border\) transparent;\s*\}/;
  const media = css.search(/@media \(hover: hover\) and \(pointer: fine\) \{\s*\.v2-quiet-scroll:hover,/);
  assert.ok(media >= 0, 'the reveal sits in a hover-and-fine-pointer media query');
  assert.match(css.slice(media), reveal);
  // Nowhere outside it: exactly one reveal in the sheet.
  assert.equal(css.match(new RegExp(reveal.source, 'g'))?.length, 1);
  // The resting rule stays unconditional.
  assert.match(css, /^\.v2-quiet-scroll \{\s*scrollbar-width: thin;\s*scrollbar-color: transparent transparent;\s*\}/m);
});
