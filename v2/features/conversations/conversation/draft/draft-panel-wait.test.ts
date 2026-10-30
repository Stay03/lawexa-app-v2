import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Lucy's recording, 25 October 2026: on the case page the chat moved to its
 * docked frame while the answer was still being written, and the editor said
 * "This draft is no longer in the chat" until the answer arrived. A draft not
 * found while the answer is still due is now waited for, not reported gone;
 * and the strip under the case page's editor no longer shows the case text. */

const panel = readFileSync(new URL('./DraftPanel.tsx', import.meta.url), 'utf8');

test('a draft not found while the answer is still due shows a waiting skeleton, not "no longer in the chat"', () => {
  // The last TURN (turn-rows.ts): a draft's "edited" line under the question does not answer it.
  assert.match(panel, /const answerDue = Boolean\(chat\?\.isStreaming\) \|\| lastTurnRow\(messages\)\?\.role === 'user';/);
  const wait = panel.indexOf('if (!draft && answerDue) {');
  const gone = panel.indexOf('This draft is no longer in the chat.');
  assert.ok(wait > 0 && gone > wait, 'the wait is decided before the "gone" message');
  assert.match(panel, /<span className="sr-only">Lawexa is still writing this draft\.<\/span>/);
});

test('the case page covers the strip under the editor in the page’s own ground', () => {
  const screen = readFileSync(new URL('../../../cases/detail/CaseScreen.tsx', import.meta.url), 'utf8');
  assert.match(
    screen,
    /<div className="pointer-events-auto sticky top-3 flex h-\[calc\(100dvh-4\.25rem\)\] flex-col">\s*<div ref=\{setDraftBox\} className="flex min-h-0 flex-1" \/>\s*<div aria-hidden data-v2-case-draft-foot="" className="-ml-3 h-3 shrink-0 bg-background" \/>/,
  );
});
