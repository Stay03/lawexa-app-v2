import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mayEditNote, noteSpace } from './note-copy';

/* A Space's copy of a note (Stay, 18 October 2026: "adding a note from my
 * notes to space creates a copy of that note so my original one remains as
 * is"; backend cf1fcc72). */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

const SPACE = { uuid: 'space-1', name: 'Moot team' };
const author = { id: 7, name: 'FIXTURE author' };

test('a copy is edited by whoever the server names, any other note by its author', () => {
  // A Contributor who did not add it edits; the adder who became a Viewer does not.
  assert.equal(mayEditNote({ is_space_copy: true, can_edit: true, user: author }, 9), true);
  assert.equal(mayEditNote({ is_space_copy: true, can_edit: false, user: author }, 7), false);
  // A copy with no answer from the server is not editable.
  assert.equal(mayEditNote({ is_space_copy: true, user: author }, 7), false);
  // Any other note: the author only, whatever `can_edit` says.
  assert.equal(mayEditNote({ user: author }, 7), true);
  assert.equal(mayEditNote({ is_space_copy: false, can_edit: true, user: author }, 9), false);
  assert.equal(mayEditNote({ user: author }, null), false);
});

test('a copy knows its space', () => {
  assert.equal(noteSpace({ is_space_copy: true, space: SPACE }), SPACE);
  assert.equal(noteSpace({ is_space_copy: false, space: null }), null);
  assert.equal(noteSpace({}), null);
});

test('the reader and the editor follow the copy rules', () => {
  const screen = read('reader', 'NoteScreen.tsx');
  assert.match(screen, /const editHref = mayEditNote\(note, userId\) \? `\/notes\/\$\{note\.slug\}\/edit` : null;/);
  // A copy's way back is its space.
  assert.match(screen, /\{ href: `\/spaces\/\$\{copySpaceUuid\}`, label: `Back to \$\{copySpaceName \?\? 'the space'\}` \}/);
  const doc = read('reader', 'NoteDocument.tsx');
  // A copy reads as a plain note (Stay, 19 October 2026, 20:55Z): no Space
  // label and no link to the original, on the page or in the editor.
  assert.doesNotMatch(doc, /Copied from|Boxes|spaceHref|copied_from/);
  assert.match(doc, /const isSpaceCopy = noteSpace\(note\) !== null;/);
  // No "Add to folder" on a copy: the server files it only in its own Space's folders.
  assert.match(doc, /canAddToFolder=\{!isSpaceCopy\}/);
  assert.match(
    read('reader', 'NoteActions.tsx'),
    /\{canAddToFolder \? <AddToFolderButton target=\{\{ type: 'note', contentId: noteId \}\} \/> : null\}/,
  );
  const edit = read('editor', 'EditNoteScreen.tsx');
  assert.match(edit, /if \(!mayEditNote\(record, viewerId\)\) \{/);
  const editor = read('editor', 'NoteEditorScreen.tsx');
  // No publish, public or price controls on a copy: the server answers 422.
  assert.match(editor, /\{record && copySpace \? null : record \? \(/);
  assert.doesNotMatch(editor, /Private to \$\{copySpace\.name\}/);
  assert.match(editor, /\{record && !copySpace \? \(\s*<PublishSheet/);
  // And no Delete: a copy leaves its space by being removed from its folder.
  assert.match(editor, /\{copySpace \? null : \(\s*<DropdownMenuItem\s*variant="destructive"/);
});
