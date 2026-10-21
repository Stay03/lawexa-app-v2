import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The channel sheet after the solo quiz (21 October 2026): its visibility
 * switch speaks the full vocabulary through the shared VisibilityGroup, a row
 * wears its chip for anything but shared, and a link or public quiz can be
 * shared from its menu. Pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the sheet uses the shared switch, with the verified-author rule and the refusal under the row', () => {
  const sheet = read('v2', 'features', 'channels', 'quiz', 'QuizLibrarySheet.tsx');
  assert.match(sheet, /import \{ VisibilityGroup \} from '\.\/VisibilityGroup';/);
  assert.doesNotMatch(sheet, /function VisibilityGroup/);
  assert.doesNotMatch(sheet, /as ChannelQuizVisibility/);
  assert.doesNotMatch(sheet, /VISIBILITY_CHOICES|useSetQuizVisibility|DropdownMenuRadioGroup/);
  assert.match(sheet, /const canPublish = canPublishPublicly\(useV2Session\(\)\);/);
  assert.match(sheet, /<VisibilityGroup\s*quiz=\{quiz\}\s*canPublish=\{canPublish\}\s*onRefused=\{setRefusal\}\s*\/>/);
  assert.match(sheet, /\{refusal \?\? 'Link copied'\}/);
});

test('a row wears its chip for anything but shared, and a link or public quiz shares from its menu', () => {
  const sheet = read('v2', 'features', 'channels', 'quiz', 'QuizLibrarySheet.tsx');
  assert.match(sheet, /\{quiz\.is_mine && quiz\.visibility !== 'shared' && \(\s*<VisibilityChip visibility=\{quiz\.visibility\} \/>/);
  assert.doesNotMatch(sheet, /<Lock /);
  assert.match(sheet, /const shareable = quiz\.visibility === 'link' \|\| quiz\.visibility === 'public';/);
  assert.match(sheet, /useShareAction\(\{ path: quizFrontHref\(quiz\.uuid\), title: quiz\.title \}\)/);
  assert.match(sheet, /\{shareable && \(\s*<DropdownMenuItem onClick=\{\(\) => void share\.share\(\)\}>/);
});

test('the two-entry vocabulary is gone; the four-entry one and its footnote remain', () => {
  const model = read('v2', 'features', 'channels', 'quiz', 'model.ts');
  assert.doesNotMatch(model, /export const VISIBILITY_CHOICES/);
  assert.match(model, /export const QUIZ_VISIBILITY_CHOICES/);
  assert.match(model, /export const VISIBILITY_FOOTNOTE/);
});
