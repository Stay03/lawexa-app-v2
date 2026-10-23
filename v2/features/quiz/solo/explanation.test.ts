import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { QUIZ_EXPLANATION_MAX } from '@/v2/features/channels/quiz/model';

/* "Why this is the answer" (Arthur, 22 October 2026: yes to explanations).
 * The author writes one per question, optionally, in the quiz form; the server
 * keeps it (backend's `explanation`, at most 1,000 characters) and sends it to
 * a player only on a FINISHED attempt, so the results' "See your answers"
 * shows it under the right answer and nothing shows it while the quiz runs. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the contract: optional on a question and on the form\'s body, 1,000 characters at most', () => {
  assert.equal(QUIZ_EXPLANATION_MAX, 1000);
  const types = read('types', 'channel-quiz.ts');
  assert.equal(types.match(/explanation\?: string \| null;/g)?.length, 2);
});

test('the form: a box per question, loaded from the quiz, always sent (empty is null)', () => {
  const form = read('v2', 'features', 'channels', 'quiz', 'QuizFormDialog.tsx');
  assert.match(form, /explanation: '',\s*\};/);
  assert.match(form, /explanation: question\.explanation \?\? '',/);
  assert.match(form, /explanation: question\.explanation\.trim\(\) \|\| null,/);
  assert.match(form, /Why this is the answer <span className="text-muted-foreground\/70">\(optional\)<\/span>/);
  assert.match(form, /maxLength=\{QUIZ_EXPLANATION_MAX\}/);
  assert.match(form, /placeholder="Shown with the answers on the results, never during the quiz\."/);
});

test('the answers: the author\'s why under the tiles, only when there is one; never in the player', () => {
  const page = read('v2', 'features', 'quiz', 'solo', 'results', 'AnswersStepper.tsx');
  assert.match(page, /const explanation = question\.explanation\?\.trim\(\) \|\| null;/);
  assert.match(page, /\{explanation \? \(\s*<div className="mt-4">\s*<p className="text-\[11px\] font-bold tracking-\[0\.08em\] text-primary uppercase">Why<\/p>/);
  assert.match(page, /whitespace-pre-line text-foreground\/85">\{explanation\}<\/p>/);
  // The play screen never draws one, in either mode.
  assert.doesNotMatch(read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx'), /explanation/);
});
