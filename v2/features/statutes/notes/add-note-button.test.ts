import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The researchers' print-note button under a selection reads "Print note" on
 * one line (Arthur, 21 October 2026, after Stay ruled out "Comment"): it
 * matches the "Print notes" button at the top of a statute. "Add print note"
 * wrapped onto two lines at the old 124 px. The runner cannot render .tsx, so
 * this reads the source. */

const button = readFileSync(join(process.cwd(), 'v2', 'features', 'statutes', 'notes', 'AddNoteButton.tsx'), 'utf8');

test('the print-note button under a selection says "Print note", on one line', () => {
  assert.match(button, /<NotebookPen aria-hidden className="size-4" \/>\s*Print note\s*<\/button>/);
  assert.match(button, /whitespace-nowrap/);
  assert.doesNotMatch(button, />\s*(Add print note|Comment)\s*</);
});
