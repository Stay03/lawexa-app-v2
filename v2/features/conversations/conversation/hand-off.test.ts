import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guards for the still hand-off from the move-first layer to the conversation
// screen (frame strip, 8 October 2026). Painting cannot run under node:test;
// the before/after film is in the commit.
const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');
const list = read('MessageList.tsx');
const skeletons = read('skeletons.tsx');
const controller = read('useConversationController.ts');
const rows = read('..', 'list', 'ConversationRow.tsx');
const listScreen = read('..', 'list', 'ConversationsList.tsx');

test('a cached open does not fade the transcript in from blank', () => {
  assert.match(list, /const \[fadeIn\] = useState\(\(\) => isLoadingHistory\);/);
  assert.match(list, /fadeIn && 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300'/);
});

test('a chat longer than the first frame is anchored to the bottom', () => {
  assert.match(list, /const anchorBottom = latestMessages\.length > OPEN_TAIL_MESSAGES;/);
  assert.match(list, /anchorBottom && 'min-h-full justify-end'/);
});

test('the composer skeleton has the real pill surface, not a muted card', () => {
  assert.match(skeletons, /border-border bg-background rounded-3xl border p-2 shadow-\[0_6px_16px_-8px_rgba\(0,0,0,0\.28\)\]/);
  assert.doesNotMatch(skeletons, /bg-muted\/50 rounded-3xl/);
});

test('the screen never publishes a null title over the one the tap set', () => {
  assert.match(controller, /if \(!conversationTitle\) return;\s*setHeaderContext\(\s*\{\s*title: stripPastedTags\(conversationTitle\),/);
});

test('list rows replay their entrance only on a first load', () => {
  assert.match(listScreen, /const \[revealRows\] = useState\(\(\) => query\.isPending\);/);
  assert.match(listScreen, /reveal=\{revealRows\}/);
  assert.match(rows, /!exiting && reveal && cn\(REVEAL, 'duration-300'\)/);
  // The hook sits above the guest early return (rules of hooks).
  assert.ok(listScreen.indexOf('const [revealRows]') < listScreen.indexOf('if (!signedIn) {'));
});
