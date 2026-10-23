import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  QUIZ_TONES,
  bestLabel,
  editedLabel,
  quizInitial,
  quizMinutesLabel,
  quizTone,
  scenarioCountLabel,
} from './rows-model';

/* Quiz piece 2 (Stay, 23 October 2026, pictures 2 and 3): the rows say the
 * size, the reader's best and the edit date in short words, on their own lines. */

const here = dirname(fileURLToPath(import.meta.url));

test('the minutes round up from the summed timers, at least one, and are absent without the field', () => {
  assert.equal(quizMinutesLabel(60), 'about 1 min');
  assert.equal(quizMinutesLabel(150), 'about 3 min');
  assert.equal(quizMinutesLabel(20), 'about 1 min');
  assert.equal(quizMinutesLabel(0), null);
  assert.equal(quizMinutesLabel(undefined), null);
});

test('scenarios and the best score are said only when there is something to say', () => {
  assert.equal(scenarioCountLabel(1), '1 scenario');
  assert.equal(scenarioCountLabel(2), '2 scenarios');
  assert.equal(scenarioCountLabel(0), null);
  assert.equal(scenarioCountLabel(undefined), null);
  assert.equal(bestLabel(2553), 'Best 2,553');
  assert.equal(bestLabel(0), 'Best 0');
  assert.equal(bestLabel(null), null);
  assert.equal(bestLabel(undefined), null);
});

test('the edit date is short: today, yesterday, a day and month, and the year only in another year', () => {
  const now = new Date(2026, 9, 23, 15, 0);
  assert.equal(editedLabel(new Date(2026, 9, 23, 9, 0).toISOString(), now), 'Edited today');
  assert.equal(editedLabel(new Date(2026, 9, 22, 18, 0).toISOString(), now), 'Edited yesterday');
  assert.equal(editedLabel(new Date(2026, 9, 21, 12, 0).toISOString(), now), 'Edited 21 Oct');
  assert.equal(editedLabel(new Date(2025, 2, 4, 12, 0).toISOString(), now), 'Edited 4 Mar 2025');
  assert.equal(editedLabel('not a date', now), null);
});

test('the tile is the same colour for the same quiz, and its letter is the first one in the title', () => {
  assert.equal(quizTone('050f4b4f-3639-49d0-8d15-97570d5bcd4d'), quizTone('050f4b4f-3639-49d0-8d15-97570d5bcd4d'));
  assert.ok(QUIZ_TONES.includes(quizTone('a')));
  assert.equal(quizInitial('land law problems'), 'L');
  assert.equal(quizInitial('"Contract" basics'), 'C');
  assert.equal(quizInitial('…'), 'Q');
});

test('who can take it never shares a line with the counts, and the date is the short one', () => {
  const library = readFileSync(join(here, 'library', 'LibraryScreen.tsx'), 'utf8');
  assert.doesNotMatch(library, /<VisibilityChip /);
  assert.doesNotMatch(library, /formatDayLabel/);
  assert.match(library, /const edited = editedLabel\(quiz\.updated_at, now\);/);
  assert.match(library, /\{visibilityFace\(quiz\.visibility\)\}/);
  const explore = readFileSync(join(here, 'explore', 'ExploreScreen.tsx'), 'utf8');
  // The author's full name gets its own line; the card grid widens on larger screens.
  assert.match(explore, /<span className="min-w-0 flex-1 truncate font-medium text-foreground\/85">\{author\}<\/span>/);
  assert.match(explore, /<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">/);
});
