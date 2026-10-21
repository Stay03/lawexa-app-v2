import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The researchers' print-note button under a selection reads "Comment" on one
 * line (Arthur, 21 October 2026): "Add print note" wrapped onto two lines at
 * the button's 124 px. The runner cannot render .tsx, so this reads the source. */

const button = readFileSync(join(process.cwd(), 'v2', 'features', 'statutes', 'notes', 'AddNoteButton.tsx'), 'utf8');

test('the print-note button under a selection says "Comment"', () => {
  assert.match(button, /<NotebookPen aria-hidden className="size-4" \/>\s*Comment\s*<\/button>/);
  assert.doesNotMatch(button, />\s*Add print note\s*</);
});
