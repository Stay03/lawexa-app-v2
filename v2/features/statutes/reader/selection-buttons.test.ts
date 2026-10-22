import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ANNOTATE_BUTTON_WIDTH,
  NOTE_BUTTON_WIDTH,
  SELECTION_BUTTON_GAP,
  SELECTION_BUTTON_MARGIN,
  annotateButtonLeft,
  noteButtonLeft,
} from './selection-buttons';

/* "Annotate" and "Print note" under a statute selection. 283a18fb widened
 * "Print note" to 136 px while "Annotate" still made room for 124, so on
 * lawexa.com the two pills touched (techlead's live pictures, 22 October
 * 2026). A selection ending near the left edge also stacked both on the
 * margin. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), 'v2', 'features', 'statutes', ...parts), 'utf8');

test('"Annotate" sits the Print note width plus 8 px to the left of "Print note"', () => {
  assert.equal(SELECTION_BUTTON_GAP, 8);
  // Selections ending mid-line, near the left edge and past the right edge, on a phone and a computer.
  for (const viewport of [390, 1440]) {
    for (const right of [0, 40, 200, 300, 389, 700, 1200, 1440, 2000]) {
      const note = noteButtonLeft(right, viewport, true);
      const annotate = annotateButtonLeft(right, viewport, true);
      assert.equal(note - (annotate + ANNOTATE_BUTTON_WIDTH), SELECTION_BUTTON_GAP, `gap at ${right}/${viewport}`);
      assert.ok(annotate >= SELECTION_BUTTON_MARGIN, `left edge at ${right}/${viewport}`);
      assert.ok(note + NOTE_BUTTON_WIDTH <= viewport - SELECTION_BUTTON_MARGIN, `right edge at ${right}/${viewport}`);
    }
  }
});

test('beside "Print note", "Annotate" moves left by the Print note width plus 8 px', () => {
  for (const [right, viewport] of [[700, 1440], [1200, 1440], [350, 390]]) {
    assert.equal(annotateButtonLeft(right, viewport, false) - annotateButtonLeft(right, viewport, true), NOTE_BUTTON_WIDTH + 8);
  }
});

test('alone, each button sits under the selection end inside the screen', () => {
  assert.equal(noteButtonLeft(700, 1440, false), 700 - NOTE_BUTTON_WIDTH);
  assert.equal(annotateButtonLeft(700, 1440, false), 700 - ANNOTATE_BUTTON_WIDTH);
  assert.equal(noteButtonLeft(40, 390, false), SELECTION_BUTTON_MARGIN);
  assert.equal(annotateButtonLeft(2000, 390, false), 390 - ANNOTATE_BUTTON_WIDTH - SELECTION_BUTTON_MARGIN);
});

test('both buttons take their width and place from selection-buttons.ts', () => {
  const note = read('notes', 'AddNoteButton.tsx');
  const annotate = read('annotations', 'AnnotateButton.tsx');
  assert.match(note, /noteButtonLeft\(rect\.right, window\.innerWidth, besideAnnotate\)/);
  assert.match(note, /width: NOTE_BUTTON_WIDTH/);
  assert.match(annotate, /annotateButtonLeft\(rect\.right, window\.innerWidth, besideNote\)/);
  assert.match(annotate, /width: ANNOTATE_BUTTON_WIDTH/);
  for (const source of [note, annotate]) assert.doesNotMatch(source, /const (WIDTH|NOTE_BUTTON|MARGIN) =/);
  assert.match(read('reader', 'StatuteDocument.tsx'), /besideAnnotate=\{annotationsEnabled && !card\}/);
});
