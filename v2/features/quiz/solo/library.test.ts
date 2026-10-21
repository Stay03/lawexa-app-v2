import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The library page (/quiz/library, 21 October 2026): every quiz the reader
 * wrote, with the owner's menu on each row and the form opening with no
 * channel in sight. Pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the library lists the reader\'s quizzes page by page and opens each on its front', () => {
  const screen = read('v2', 'features', 'quiz', 'solo', 'library', 'LibraryScreen.tsx');
  assert.match(screen, /useInfiniteQuery\(soloQuizQueries\.library\(\{ viewerId \}\)\)/);
  assert.match(screen, /href=\{quizFrontHref\(quiz\.uuid\)\}/);
  // The sentinel is rooted in the shell's scroller, like every v2 list.
  assert.match(screen, /rootRef: scrollRootRef,/);
  // The heading is drawn for real in the fallback, the rows reserved.
  assert.match(screen, /<LibraryHeading onCreate=\{\(\) => undefined\} \/>\s*<LibraryListSkeleton \/>/);
  assert.match(screen, /<div aria-hidden inert className=\{LIST_COLUMN\}>/);
});

test('every row carries the owner\'s menu: who can find it, Edit, Delete', () => {
  const screen = read('v2', 'features', 'quiz', 'solo', 'library', 'LibraryScreen.tsx');
  assert.match(screen, /<VisibilityGroup quiz=\{quiz\} canPublish=\{canPublish\} onRefused=\{setRefusal\} \/>/);
  assert.match(screen, /const canPublish = canPublishPublicly\(session\);/);
  assert.match(screen, /<VisibilityChip visibility=\{quiz\.visibility\} \/>/);
  // A refusal is said under its own row, never toasted.
  assert.match(screen, /\{refusal && \(\s*<p\s*role="alert"/);
  assert.doesNotMatch(screen, /from 'sonner'/);
});

test('the form opens without a channel, keyed per opening, and files into the library', () => {
  const screen = read('v2', 'features', 'quiz', 'solo', 'library', 'LibraryScreen.tsx');
  assert.match(screen, /<QuizFormDialog\s*key=\{formOpenings\}\s*open=\{formOpen\}\s*onOpenChange=\{setFormOpen\}\s*viewerId=\{viewerId\}\s*quizUuid=\{editingUuid\}\s*\/>/);
  const form = read('v2', 'features', 'channels', 'quiz', 'QuizFormDialog.tsx');
  assert.match(form, /channelUuid\?: string;/);
  assert.match(form, /channelName\?: string;/);
  assert.match(form, /destination\?: QuizDestination;/);
  assert.match(form, /if \(room\) createQuiz\.mutate\(\{ channelUuid: room\.uuid, payload \}, onCreated\);\s*else createLibraryQuiz\.mutate\(payload, onCreated\);/);
  // The channel create takes its room in the variables now.
  assert.match(read('v2', 'features', 'channels', 'quiz', 'mutations.ts'), /export function useCreateQuiz\(\) \{/);
});

test('the visibility group offers Everyone disabled with the reason until the author is verified', () => {
  const group = read('v2', 'features', 'channels', 'quiz', 'VisibilityGroup.tsx');
  assert.match(group, /const locked = choice\.needsVerifiedAuthor && !canPublish;/);
  assert.match(group, /disabled=\{locked\}/);
  assert.match(group, /\{locked \? PUBLIC_NEEDS_VERIFIED_AUTHOR : choice\.hint\}/);
  // A 403 on a public save is the same sentence, in place.
  assert.match(group, /status === 403 && value === 'public'\s*\? PUBLIC_NEEDS_VERIFIED_AUTHOR\s*: message,/);
  assert.match(group, /visibilityChoicesFor\(quizHasRoom\(quiz\)\)/);
  // The delete dialog is shared with the sheet, which no longer carries its own.
  const sheet = read('v2', 'features', 'channels', 'quiz', 'QuizLibrarySheet.tsx');
  assert.match(sheet, /import \{ DeleteQuizDialog \} from '\.\/DeleteQuizDialog';/);
  assert.doesNotMatch(sheet, /function DeleteQuizDialog/);
});

test('the route is private, noindex, and its fallback is the screen\'s own', () => {
  const page = read('app', 'v2', 'quiz', '(solo)', 'library', 'page.tsx');
  assert.match(page, /title: 'My quizzes',/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(read('app', 'v2', 'quiz', '(solo)', 'library', 'loading.tsx'), /return <LibraryFallback \/>;/);
});
