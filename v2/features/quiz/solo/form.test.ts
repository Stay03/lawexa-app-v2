import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The quiz form after the solo quiz (21 October 2026): it opens outside a
 * channel, it chooses who can find the quiz, "Everyone" waits on a verified
 * author, and the 20-question cap is gone. Pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

const form = () => read('v2', 'features', 'channels', 'quiz', 'QuizFormDialog.tsx');

test('the 20-question cap is gone: no constant, no disabled Add, no n/20 counter', () => {
  assert.doesNotMatch(read('v2', 'features', 'channels', 'quiz', 'model.ts'), /export const QUIZ_MAX_QUESTIONS/);
  const source = form();
  assert.doesNotMatch(source, /QUIZ_MAX_QUESTIONS/);
  assert.doesNotMatch(source, /Up to \{/);
  // One short line (Arthur's redesign, part A), with no limit in it.
  assert.match(source, /'Each question has its own timer, and faster right answers score more\.'/);
  assert.match(source, /<Plus aria-hidden className="size-4" \/>\s*Add a question\s*<\/Button>/);
  // The count still shows, as a caption over the cards rather than a limit.
  assert.match(source, /Questions\{' '\}\s*<span className="font-normal tabular-nums text-muted-foreground">\s*· \{questions\.length\}/);
});

test('who can find the quiz is chosen in the form, owner only, with the right default', () => {
  const source = form();
  assert.match(source, /useState<ChannelQuizVisibility>\(\s*room \? 'shared' : 'private',\s*\)/);
  assert.match(source, /setVisibility\(loaded\.visibility\);/);
  assert.match(source, /const mayEditVisibility = !isEdit \|\| loaded\?\.is_mine === true;/);
  assert.match(source, /const inRoom = room !== null \|\| \(loaded !== null && quizHasRoom\(loaded\)\);\s*const visibilityChoices = visibilityChoicesFor\(inRoom\);/);
  // Sent on create always, on update only by the owner.
  assert.match(source, /description: description\.trim\(\) \|\| undefined,\s*\.\.\.about,\s*visibility,\s*settings,/);
  assert.match(source, /visibility: mayEditVisibility \? visibility : undefined,/);
});

test('"Everyone" is drawn disabled with its reason, and a 403 keeps the draft and says why', () => {
  const source = form();
  assert.match(source, /const canPublish = canPublishPublicly\(useV2Session\(\)\);/);
  assert.match(source, /const locked = choice\.needsVerifiedAuthor && !canPublish;/);
  // One compact selector, "Who can access this quiz?" (Arthur's redesign, part A).
  assert.match(source, /Who can access this quiz\?/);
  assert.match(source, /<SelectItem key=\{choice\.id\} value=\{choice\.id\} disabled=\{locked\}>/);
  assert.match(source, /\{locked \? PUBLIC_NEEDS_VERIFIED_AUTHOR : choice\.hint\}/);
  assert.match(source, /if \(status === 403 && mayEditVisibility && visibility === 'public'\) \{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*setPublicRefused\(true\);\s*setError\(null\);\s*return;\s*\}/);
  assert.match(source, /\{publicRefused && \(\s*<p\s*role="alert"/);
  // The choice cards are the sharing feature's, which learned `disabled`.
  assert.match(read('v2', 'features', 'sharing', 'VisibilityOption.tsx'), /disabled=\{busy \|\| disabled\}/);
});
