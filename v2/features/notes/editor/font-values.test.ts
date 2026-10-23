import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NOTE_FONTS, NOTE_SIZES, noteFont, noteSize } from '@/lib/notes/note-fonts';

/* Font type and size in notes (Stay, 23 October 2026: "Font size and type for
 * now"), as agreed with backend: <span data-font data-size>, values from a
 * closed list, never a style. */

const here = dirname(fileURLToPath(import.meta.url));

test('only the agreed fonts and sizes are kept; anything else is dropped', () => {
  assert.deepEqual([...NOTE_FONTS], ['Times New Roman', 'Arial', 'Georgia']);
  assert.deepEqual([...NOTE_SIZES], [10, 11, 12, 14, 16, 18, 20, 24]);
  assert.equal(noteFont('Georgia'), 'Georgia');
  assert.equal(noteFont('Comic Sans MS'), null);
  assert.equal(noteFont('georgia'), null);
  assert.equal(noteFont(null), null);
  assert.equal(noteSize('12'), 12);
  assert.equal(noteSize(24), 24);
  assert.equal(noteSize('13'), null);
  assert.equal(noteSize('12pt'), null);
  assert.equal(noteSize(undefined), null);
});

test('the mark writes data attributes, never a style, and is in every note editor', () => {
  const mark = readFileSync(join(here, 'font-style.ts'), 'utf8');
  assert.match(mark, /renderHTML: \(attributes\) => \(attributes\.font \? \{ 'data-font': attributes\.font \} : \{\}\)/);
  assert.match(mark, /renderHTML: \(attributes\) => \(attributes\.size \? \{ 'data-size': String\(attributes\.size\) \} : \{\}\)/);
  assert.doesNotMatch(mark, /['"]style['"]|\bstyle:|\.style\b/);
  // A span with no allowed value is not this mark.
  assert.match(mark, /noteFont\(element\.getAttribute\('data-font'\)\) \|\| noteSize\(element\.getAttribute\('data-size'\)\) \? null : false/);
  const extensions = readFileSync(join(here, 'extensions.ts'), 'utf8');
  assert.match(extensions, /^\s+FontStyle,$/m);
  // The editor draws the fonts from the attributes in CSS.
  const css = readFileSync(join(here, '..', 'note-fonts.css'), 'utf8');
  for (const font of NOTE_FONTS) assert.ok(css.includes(`[data-font='${font}']`), font);
  for (const size of NOTE_SIZES) assert.ok(css.includes(`[data-size='${size}'] { font-size: ${size}pt; }`), String(size));
});

test('a finished draft opens in the editor with the font menus; one still being written reads', () => {
  const panel = readFileSync(join(here, '..', '..', 'conversations', 'conversation', 'draft', 'DraftPanel.tsx'), 'utf8');
  assert.match(panel, /\{draft\.complete && conversationId \? \(\s*<DraftEditor\s+conversationId=\{conversationId\}\s+ordinal=\{ordinal\}\s+title=\{draft\.title\}\s+markdown=\{draft\.body\}\s+space=\{space\}\s+\/>/);
  const editor = readFileSync(join(here, '..', '..', 'conversations', 'conversation', 'draft', 'DraftEditor.tsx'), 'utf8');
  assert.match(editor, /<FontMenu editor=\{editor\} \/>\s*<SizeMenu editor=\{editor\} \/>/);
  assert.match(editor, /content: readDraftEdit\(conversationId, ordinal\) \?\? markdownToDoc\(markdown\),/);
});
