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
    'className="v2-quiet-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain"',
  ],
  // The folder picker's list, inside a dialog that scrolls (its drillable rows' sr-only hint).
  [
    ['v2', 'features', 'folders', 'picker', 'PickerBody.tsx'],
    'className="relative -mx-1 max-h-[min(24rem,45dvh)] min-h-0 overflow-y-auto overscroll-contain px-1"',
  ],
  // "Move to space": the rows' sr-only "In it now" on a phone.
  [
    ['v2', 'features', 'spaces', 'move', 'MoveToSpaceDialog.tsx'],
    "'relative -mx-2 max-h-[min(22rem,55vh)] overflow-y-auto overscroll-contain',",
  ],
  // A channel's feed: the empty channel's intro sr-only visibility label.
  [
    ['v2', 'features', 'channels', 'feed', 'ChannelFeed.tsx'],
    'className="v2-quiet-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain"',
  ],
  // The space pane: lobby and content rows carry sr-only text.
  [
    ['v2', 'features', 'collab', 'shell', 'CollabFrame.tsx'],
    'className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"',
  ],
];

test('every inner scroller with absolutely placed children is a containing block', () => {
  for (const [path, className] of SCROLLERS) {
    assert.ok(read(...path).includes(className), `${path.join('/')} keeps its scroller positioned`);
  }
});
