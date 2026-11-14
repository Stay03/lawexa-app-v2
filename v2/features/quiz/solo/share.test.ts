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
  // The sheet gets the title where there is one, and the sentence and the link
  // as one text (shareData: given apart, a share target glued the sentence onto
  // the address, 14 November 2026); the clipboard fallback copies the link alone.
  assert.match(hook, /await navigator\.share\(shareData\(\{ title, text, url \}\)\);/);
  assert.match(hook, /if \(error instanceof DOMException && error\.name === 'AbortError'\) return;/);
  assert.match(hook, /await navigator\.clipboard\.writeText\(url\);/);
  assert.match(hook, /return \{ share, copied \};/);
  const pill = read('v2', 'features', 'sharing', 'ShareButton.tsx');
  assert.match(pill, /const \{ share, copied \} = useShareAction\(\{ path, title \}\);/);
  assert.doesNotMatch(pill, /navigator\./);
  assert.match(pill, /\{copied \? 'Link copied' : 'Share'\}/);
});

test('every share site hands on the quiz front, and only where a link can open it', () => {
  // Challenge a friend, on the front and the results alike, goes through one
  // hook: the quiz's link, through the one share behaviour (Arthur, 10 November 2026).
  const hook = read('v2', 'features', 'quiz', 'solo', 'use-challenge-friend.ts');
  // The quiz front, or a challenge link to it from a finished attempt.
  assert.match(hook, /const path = fromAttempt \? quizChallengeHref\(quizUuid, fromAttempt\) : quizFrontHref\(quizUuid\);/);
  assert.match(hook, /useShareAction\(\{ path, title, text \}\)/);
  const front = read('v2', 'features', 'quiz', 'solo', 'front', 'QuizFrontScreen.tsx');
  assert.match(front, /const challenge = useChallengeFriend\(\{\s*quizUuid,/);
  assert.match(front, /\{challenge\.available && \(\s*<RaisedButton[\s\S]*?onClick=\{challenge\.challenge\}/);
  const actions = read('v2', 'features', 'quiz', 'solo', 'results', 'ResultsActions.tsx');
  assert.match(actions, /useChallengeFriend\(\{\s*quizUuid,\s*fromAttempt: attemptUuid,\s*title: quizTitle,\s*text: challenge,\s*visibility,\s*isMine,\s*\}\)/);
  assert.match(actions, /\{friend\.available && \(\s*<RaisedButton\s*tone="quiet"/);
  const results = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptResultsScreen.tsx');
  assert.match(results, /visibility=\{visibility\}\s*isMine=\{isMine\}/);
  const library = read('v2', 'features', 'quiz', 'solo', 'library', 'LibraryScreen.tsx');
  assert.match(library, /const shareable = quiz\.visibility === 'link' \|\| quiz\.visibility === 'public';/);
  assert.match(library, /useShareAction\(\{ path: quizFrontHref\(quiz\.uuid\), title: quiz\.title \}\)/);
  assert.match(library, /\{shareable && \(\s*<DropdownMenuItem onClick=\{\(\) => void share\.share\(\)\}>/);
  // The menu is gone by the time the clipboard answers, so the row says it.
  assert.match(library, /\{share\.copied && !refusal && \(\s*<p\s*role="status"/);
});
