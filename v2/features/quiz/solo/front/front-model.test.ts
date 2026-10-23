import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { quizContents, takenLabel } from './front-model';

/* Quiz piece 3 (Stay, 23 October 2026, picture 4): a quiz's page says what is
 * in it without naming a question, until Arthur picks "first 2 or all". */

const here = dirname(fileURLToPath(import.meta.url));

test('the contents count the free-standing questions, then each scenario by title, in order', () => {
  const lines = quizContents(
    [{ scenario_uuid: null }, { scenario_uuid: 's2' }, { scenario_uuid: 's2' }, { scenario_uuid: undefined }, { scenario_uuid: 's1' }],
    [
      { uuid: 's2', title: 'The restrictive covenant', position: 2 },
      { uuid: 's1', title: 'The right of way over Plot 14', position: 1 },
    ],
  );
  assert.deepEqual(lines.map((line) => line.label), [
    '2 questions on their own',
    'The right of way over Plot 14 · 1 question',
    'The restrictive covenant · 2 questions',
  ]);
});

test('an untitled scenario is named by its place, and a scenario with no questions is left out', () => {
  const lines = quizContents(
    [{ scenario_uuid: 'a' }],
    [
      { uuid: 'a', title: '  ', position: 1 },
      { uuid: 'b', title: 'Unused', position: 2 },
    ],
  );
  assert.deepEqual(lines.map((line) => line.label), ['Scenario 1 · 1 question']);
  assert.deepEqual(quizContents([{ scenario_uuid: null }], []).map((line) => line.label), ['1 question on its own']);
});

test('taken says how often, once the reader has finished it', () => {
  assert.equal(takenLabel(1), 'Taken once');
  assert.equal(takenLabel(3), 'Taken 3 times');
  assert.equal(takenLabel(0), null);
  assert.equal(takenLabel(null), null);
});

test('the page names no question text, and Start stays in reach on a phone', () => {
  const screen = readFileSync(join(here, 'QuizFrontScreen.tsx'), 'utf8');
  assert.match(screen, /const contents = quizContents\(questions, quiz\.scenarios \?\? \[\]\);/);
  assert.match(screen, /\{line\.label\}/);
  assert.doesNotMatch(screen, /\.question\b(?!s)/);
  assert.match(screen, /fixed inset-x-0 bottom-0 z-10[^"]*md:static/);
});
