import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { takenLabel } from './front-model';

/* Quiz piece 3 (Stay, 23 October 2026, picture 4): a quiz's page names no
 * question. Its "What is in it" list went on 24 October 2026 (Stay: "so many
 * unnecessary text"); the facts line says how many questions and scenarios. */

const here = dirname(fileURLToPath(import.meta.url));

test('taken says how often, once the reader has finished it', () => {
  assert.equal(takenLabel(1), 'Taken once');
  assert.equal(takenLabel(3), 'Taken 3 times');
  assert.equal(takenLabel(0), null);
  assert.equal(takenLabel(null), null);
});

test('the page names no question text, and Start stays in reach on a phone', () => {
  const screen = readFileSync(join(here, 'QuizFrontScreen.tsx'), 'utf8');
  const drawn = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(drawn, /What is in it|quizContents|on their own/);
  // The scenarios are counted in the tags, and only when there are some.
  assert.match(screen, /const extraTags = \[scenarios, quiz\.visibility === 'public' \? null : visibilityFace\(quiz\.visibility\)\]\.filter\(/);
  assert.match(screen, /const scenarios = scenarioCountLabel\(quiz\.scenario_count \?\? quiz\.scenarios\?\.length\);/);
  assert.doesNotMatch(screen, /\.question\b(?!s)/);
  assert.match(screen, /fixed inset-x-0 bottom-0 z-10[^"]*md:static/);
});
