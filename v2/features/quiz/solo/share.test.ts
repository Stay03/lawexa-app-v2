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
  // The sheet gets the link, the title where there is one, and the sentence
  // where there is one; the clipboard fallback still copies the link alone.
  assert.match(hook, /const data: ShareData = \{ url \};\s*if \(title\) data\.title = title;\s*if \(text\) data\.text = text;/);
  assert.match(hook, /await navigator\.share\(data\);/);
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
  assert.match(front, /const challenge = useShareAction\(\{\s*path: quizFrontHref\(quizUuid\),/);
  assert.match(front, /\{shareable && \(\s*<Button[\s\S]*?onClick=\{\(\) => void challenge\.share\(\)\}/);
  // The results' Challenge a friend: the quiz's link with the challenge
  // sentence, through the same hook, and only where a link can open it.
  const actions = read('v2', 'features', 'quiz', 'solo', 'results', 'ResultsActions.tsx');
  assert.match(actions, /useShareAction\(\{\s*path: quizFrontHref\(quizUuid\),\s*title: quizTitle,\s*text: challenge,\s*\}\)/);
  assert.match(actions, /\{shareable && \(\s*<RaisedButton\s*tone="quiet"/);
  assert.match(read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptResultsScreen.tsx'), /shareable=\{shareable\}/);
  const library = read('v2', 'features', 'quiz', 'solo', 'library', 'LibraryScreen.tsx');
  assert.match(library, /const shareable = quiz\.visibility === 'link' \|\| quiz\.visibility === 'public';/);
  assert.match(library, /useShareAction\(\{ path: quizFrontHref\(quiz\.uuid\), title: quiz\.title \}\)/);
  assert.match(library, /\{shareable && \(\s*<DropdownMenuItem onClick=\{\(\) => void share\.share\(\)\}>/);
  // The menu is gone by the time the clipboard answers, so the row says it.
  assert.match(library, /\{share\.copied && !refusal && \(\s*<p\s*role="status"/);
});
