import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Sharing a quiz by link (21 October 2026): one share behaviour, offered on
 * the quiz front, the results and the library row's menu, and only where a
 * link can open the quiz. Pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the share behaviour is one hook, and the pill composes it unchanged', () => {
  const hook = read('v2', 'features', 'sharing', 'use-share-action.ts');
  assert.match(hook, /await navigator\.share\(title \? \{ title, url \} : \{ url \}\);/);
  assert.match(hook, /if \(error instanceof DOMException && error\.name === 'AbortError'\) return;/);
  assert.match(hook, /await navigator\.clipboard\.writeText\(url\);/);
  assert.match(hook, /return \{ share, copied \};/);
  const pill = read('v2', 'features', 'sharing', 'ShareButton.tsx');
  assert.match(pill, /const \{ share, copied \} = useShareAction\(\{ path, title \}\);/);
  assert.doesNotMatch(pill, /navigator\./);
  assert.match(pill, /\{copied \? 'Link copied' : 'Share'\}/);
});

test('every share site hands on the quiz front, and only where a link can open it', () => {
  const front = read('v2', 'features', 'quiz', 'solo', 'front', 'QuizFrontScreen.tsx');
  assert.match(front, /\{shareable && \(\s*<ShareButton\s*path=\{quizFrontHref\(quiz\.uuid\)\}/);
  const summary = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptSummary.tsx');
  assert.match(summary, /\{shareable && \(\s*<ShareButton\s*path=\{quizFrontHref\(attempt\.quiz\.uuid\)\}/);
  const library = read('v2', 'features', 'quiz', 'solo', 'library', 'LibraryScreen.tsx');
  assert.match(library, /const shareable = quiz\.visibility === 'link' \|\| quiz\.visibility === 'public';/);
  assert.match(library, /useShareAction\(\{ path: quizFrontHref\(quiz\.uuid\), title: quiz\.title \}\)/);
  assert.match(library, /\{shareable && \(\s*<DropdownMenuItem onClick=\{\(\) => void share\.share\(\)\}>/);
  // The menu is gone by the time the clipboard answers, so the row says it.
  assert.match(library, /\{share\.copied && !refusal && \(\s*<p\s*role="status"/);
});
