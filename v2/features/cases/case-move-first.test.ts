import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* A case opens at once (Stay, 17 October 2026: "It should show the title and
 * the text area like in chat while the case content skeleton shows then the
 * content comes"). A first tap on a case waited for the server and the case
 * reader's code with the old page on screen: the cases list does not prefetch
 * (32 pages for 15 rows), so the route's loading boundary was not in the
 * browser either. Case links now move first, as chat rows do: the tap paints
 * the case's own loading shape, with the row's name and the "Ask about this
 * case" box, before any route work. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the shell has a case frame, and it is the case page\'s own loading shape', () => {
  const moveFirst = read('v2', 'shell', 'move-first.tsx');
  assert.match(moveFirst, /const MOVE_FIRST_FRAMES = \{\s*conversation: ConversationMoveFrame,\s*case: CaseMoveFrame,\s*page: PageFrame,\s*\}/);
  // The router is still on the list in the tap, so the frame reads the slug from where the tap is going.
  assert.match(moveFirst, /function CaseMoveFrame\(\{ href \}: \{ href: string \}\) \{\s*return <CaseFallbackFor slug=\{slugOf\(new URL\(href, window\.location\.href\)\.pathname\)\} \/>;/);
  assert.match(moveFirst, /<Frame title=\{move\.title\} href=\{move\.href\} \/>/);
});

test('the loading shape ends in the ask box, in the page\'s own column, so nothing moves at the hand-off', () => {
  const fallback = read('v2', 'features', 'cases', 'detail', 'CaseFallback.tsx');
  assert.match(fallback, /<CaseDocumentSkeleton masthead=\{peek \? <PeekMasthead peek=\{peek\} \/> : undefined\} \/>\s*<CaseAskShell \/>/);
  // CaseScreen's column: a full-height flex column, the box pinned at its bottom.
  assert.match(fallback, /className="v2-case-doc relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-5 sm:pt-8"/);
  assert.match(
    read('v2', 'features', 'cases', 'detail', 'CaseScreen.tsx'),
    /className="v2-case-doc relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-5 sm:pt-8"/,
  );
  // CaseAskDock's resting wrapper and the composer's box, inert.
  assert.match(fallback, /<div className="sticky bottom-0 z-10 -mx-4 mt-auto px-4 pb-3 pt-10">/);
  assert.match(read('v2', 'features', 'cases', 'detail', 'CaseAsk.tsx'), /'sticky bottom-0 -mx-4 mt-auto px-4 pb-3 pt-10'/);
  assert.match(fallback, /Ask about this case/);
  assert.match(fallback, /<div aria-hidden inert className="flex min-h-full w-full">/);
  // Still nothing heavy behind the shell or the loading boundary.
  assert.doesNotMatch(fallback, /from '\.\/Case(Screen|Document|Ask|ChatCore|ChatPanel)'/);
});

test('the case links move first, and the list still does not prefetch', () => {
  const row = read('v2', 'features', 'cases', 'list', 'CaseRow.tsx');
  assert.match(row, /<MoveFirstLink\s+href=\{href\}\s+kind="case"\s+title=\{row\.title\}\s+prefetch=\{false\}/);
  assert.doesNotMatch(row, /from 'next\/link'/);

  // An answer's case citation: the link itself (pointer), and "Open case" in its preview (touch and pointer).
  const mention = read('v2', 'features', 'conversations', 'conversation', 'markdown', 'CaseMentionLink.tsx');
  assert.equal(mention.match(/<MoveFirstLink href=\{casePath\} kind="case"/g)?.length, 2);
  assert.equal(mention.match(/onOpen=\{\(\) => setOpen\(false\)\}/g)?.length, 2);
  const preview = read('v2', 'features', 'conversations', 'conversation', 'markdown', 'CasePreview.tsx');
  assert.equal(preview.match(/<MoveFirstLink\s+href=\{href\}\s+kind="case"/g)?.length, 2);
  // The preview's "Open case" leaves the case's name for the frame, as a row does.
  assert.match(preview, /onClick=\{\(\) =>\s*rememberCasePeek\(\{\s*slug,\s*title,/);
  assert.match(preview, /onMove=\{onOpen\}/);
});
