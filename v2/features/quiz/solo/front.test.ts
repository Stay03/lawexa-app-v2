import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FRONT_SCORING_NOTE, frontChallengeText } from './front/front-model';

/* The quiz front (/quiz/q/{uuid}, 21 October 2026): what the quiz is, who
 * wrote it, the reveal choice, and Start for an account or the sign-in door
 * for everyone else. Pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

const screen = () => read('v2', 'features', 'quiz', 'solo', 'front', 'QuizFrontScreen.tsx');

test('an account reads the detail, everyone else the public preview, into one body', () => {
  const source = screen();
  assert.match(source, /const preview = readsPreview\(session\);/);
  assert.match(source, /channelQuizQueries\.quizDetail\(quizUuid, \{ viewerId \}\),\s*enabled: !preview,/);
  assert.match(source, /soloQuizQueries\.preview\(quizUuid, \{ viewerId \}\),\s*enabled: preview,/);
  // One 404 sentence for a private quiz, a deleted one and a wrong link.
  assert.match(source, /title="We couldn't find this quiz"/);
  // The questions are never listed before the quiz is taken.
  assert.doesNotMatch(source, /questions\.map\(/);
});

test('Start needs an account and sends the reveal choice; everyone else gets the sign-in door', () => {
  const source = screen();
  assert.match(source, /const mayTake = canTakeQuiz\(session\);/);
  assert.match(source, /startAttempt\.mutate\(revealMode, \{\s*onSuccess: \(response\) => router\.push\(attemptHref\(response\.data\.uuid\)\),/);
  assert.match(source, /\{mayTake \? \(\s*<Button size="lg" className="min-w-0 flex-1" onClick=\{start\}/);
  assert.match(source, /<Link href=\{signInHref\(pathname\)\}>Sign in to take this quiz<\/Link>/);
  // A stale session's 401 is not bounced by the client on this page, so the
  // screen takes the reader to sign in itself.
  assert.match(source, /if \(status === 401\) \{\s*router\.push\(signInHref\(pathname\)\);/);
  // The reveal choice opens on the default and offers both ways.
  assert.match(source, /useState<QuizRevealMode>\(DEFAULT_REVEAL_MODE\)/);
  // A small "Answer reveal" choice, not the two big cards (Arthur, 24 October 2026).
  assert.match(source, /Answer reveal\s*<\/label>\s*<Select value=\{revealMode\} onValueChange=\{\(value\) => setRevealMode\(value as QuizRevealMode\)\}>/);
  assert.match(source, /REVEAL_MODE_CHOICES\.map\(\(choice\) => \(\s*<SelectItem key=\{choice\.id\} value=\{choice\.id\}>/);
  assert.doesNotMatch(source, /VisibilityOption|When do you want to see the answers\?/);
});

test("the owner's Edit and Delete ride the bar's menu, and Delete leaves for the library", () => {
  const source = screen();
  assert.match(source, /setScreenContext\(\{ pathname, back: null, actions \}\);/);
  assert.match(source, /\{ id: 'edit', label: 'Edit quiz', icon: Pencil, onSelect: openEdit \}/);
  assert.match(source, /id: 'delete',\s*label: 'Delete quiz',\s*icon: Trash2,\s*destructive: true,/);
  assert.match(source, /onDeleted=\{\(\) => router\.replace\(LIBRARY_HREF\)\}/);
  // No second kebab in the body.
  assert.doesNotMatch(source, /DropdownMenu/);
  // Share only where a link can open it; the owner of a private one is told why.
  assert.match(source, /const shareable = quiz\.visibility === 'link' \|\| quiz\.visibility === 'public';/);
  // Challenge a friend, a secondary button beside Start, the one gold action.
  assert.match(source, /\{shareable && \(\s*<Button\s*type="button"\s*variant="outline"/);
  assert.match(source, /\{challenge\.copied \? 'Link copied' : 'Challenge a friend'\}/);
  assert.match(source, /Only you can open this quiz\. Change who can find it to share it by link\./);
});

test('the route unfurls through the public preview and indexes only a public quiz', () => {
  const page = read('app', 'v2', 'quiz', 'q', '[quizUuid]', 'page.tsx');
  assert.match(page, /const quiz = await fetchQuizPreviewForMetadata\(quizUuid\);/);
  assert.match(page, /const indexable = quiz\.visibility === 'public';/);
  assert.match(page, /robots: \{ index: indexable, follow: indexable \}/);
  assert.match(page, /title: \{ absolute: SEO\.defaultTitle \},\s*description: SEO\.defaultDescription,\s*robots: \{ index: false, follow: false \},/);
  assert.match(read('app', 'v2', 'quiz', 'q', '[quizUuid]', 'loading.tsx'), /return <QuizFrontFallback \/>;/);
  const server = read('lib', 'api', 'server.ts');
  // Read without credentials, through the preview, proved field by field.
  assert.match(server, /`\$\{apiUrl\}\/api\/channel-quizzes\/\$\{encodeURIComponent\(quizUuid\)\}\/preview`/);
  assert.match(server, /if \(typeof title !== 'string' \|\| typeof visibility !== 'string'\) return null;/);
  assert.doesNotMatch(server.slice(server.indexOf('fetchQuizPreviewForMetadata')), /Authorization|apiClient/);
});

/* Arthur, 24 October 2026: a smaller title on a phone, the facts in one line,
 * the author's photo and name (never "You wrote this", never "drafted by
 * Lawexa"), a short scoring note, and no em dash on the page. */
test('the quiz page says what it is in one plain line, with short copy and no em dash', () => {
  const source = screen();
  assert.match(source, /<h1 className="text-xl leading-snug font-semibold tracking-tight text-balance text-foreground md:text-3xl">/);
  assert.match(source, /<span className="truncate font-medium text-foreground\/85">\{quiz\.creator\?\.name \?\? 'Someone who has left'\}<\/span>/);
  assert.match(source, /const facts = \[questionCountLabel\(count\), scenarios, minutes\]/);
  assert.doesNotMatch(source, /You wrote this|drafted by Lawexa|FactPill|SPEED_SCORING_NOTE/);
  // Gold only for Start: the best is in the plain colour.
  assert.doesNotMatch(source, /text-primary/);
  const visible = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(visible, /\u2014/);
  assert.equal(FRONT_SCORING_NOTE, 'Right answers score up to 1,000 points. The faster you answer, the more you keep.');
  assert.doesNotMatch(FRONT_SCORING_NOTE, /\u2014/);
  assert.equal(frontChallengeText('TEST DATA Land law', 4947), 'I scored 4,947 points on TEST DATA Land law. Can you beat me?');
  assert.equal(frontChallengeText('TEST DATA Land law', null), 'Try TEST DATA Land law on Lawexa. How many can you get right?');
});
