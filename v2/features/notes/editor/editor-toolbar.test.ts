import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMacPlatform, shortcutLabel } from './shortcut-label';
import {
  BLOCK_VERBS,
  CLEAR_FORMATTING,
  CODE_VERB,
  REDO_KEYS,
  STYLE_OPTIONS,
  TEXT_VERBS,
  UNDO_KEYS,
  styleLabel,
} from './toolbar-verbs';

/* Arthur's editor step 1 (go 19 October 2026, 17:36Z; thread e04e8a92), the
 * toolbar part: undo and redo on a computer, a style dropdown, clear
 * formatting, tooltips with shortcuts, and a More menu on the phone. No new
 * package. H1 stays out of the dropdown until Stay says otherwise. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), 'v2', 'features', 'notes', 'editor', ...parts), 'utf8').replace(/\r\n/g, '\n');

test('a shortcut reads as the keyboard writes it: ⌘ on a Mac, Ctrl elsewhere', () => {
  assert.equal(shortcutLabel('Mod-b', true), '⌘B');
  assert.equal(shortcutLabel('Mod-b', false), 'Ctrl+B');
  assert.equal(shortcutLabel('Mod-Shift-8', true), '⌘⇧8');
  assert.equal(shortcutLabel('Mod-Shift-8', false), 'Ctrl+Shift+8');
  assert.equal(shortcutLabel('Mod-Alt-2', true), '⌘⌥2');
  assert.equal(shortcutLabel('Mod-Alt-2', false), 'Ctrl+Alt+2');
  assert.equal(shortcutLabel('Mod-\\', false), 'Ctrl+\\');
  assert.equal(isMacPlatform('MacIntel', ''), true);
  assert.equal(isMacPlatform('Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);
  assert.equal(isMacPlatform('', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), true);
});

test('every tooltip promises a key the editor answers (Tiptap 3.15.3 bindings)', () => {
  const bindings = Object.fromEntries([...TEXT_VERBS, ...BLOCK_VERBS, CODE_VERB].map((v) => [v.verb, v.keys]));
  assert.deepEqual(bindings, {
    bold: 'Mod-b',
    italic: 'Mod-i',
    underline: 'Mod-u',
    strike: 'Mod-Shift-s',
    h2: 'Mod-Alt-2',
    h3: 'Mod-Alt-3',
    bulletList: 'Mod-Shift-8',
    orderedList: 'Mod-Shift-7',
    blockquote: 'Mod-Shift-b',
    code: 'Mod-e',
  });
  assert.equal(UNDO_KEYS, 'Mod-z');
  assert.equal(REDO_KEYS, 'Mod-Shift-z');
  // Clear formatting's own binding is registered by the editor, with the same rule as the button.
  assert.equal(CLEAR_FORMATTING.keys, 'Mod-\\');
  const extensions = read('extensions.ts');
  assert.match(extensions, /'Mod-\\\\': \(\) => \{/);
  assert.match(extensions, /ClearFormattingShortcut,\n  \];/);
});

test('the style dropdown offers Normal text, Heading and Subheading, never H1, and sets rather than toggles', () => {
  assert.deepEqual(STYLE_OPTIONS.map((o) => `${o.style} ${o.label} ${o.keys}`), [
    'paragraph Normal text Mod-Alt-0',
    'h2 Heading Mod-Alt-2',
    'h3 Subheading Mod-Alt-3',
  ]);
  // A legacy H1 in a note still shows its name.
  assert.equal(styleLabel('h1'), 'Large heading');
  assert.equal(styleLabel('paragraph'), 'Normal text');
  const formatting = read('formatting.ts');
  assert.match(formatting, /if \(style === 'paragraph'\) chain\.setParagraph\(\)\.run\(\);\s*else chain\.setHeading\(\{ level: style === 'h2' \? 2 : 3 \}\)\.run\(\);/);
  assert.match(read('StyleSelect.tsx'), /onSelect=\{\(\) => applyStyle\(editor, option\.style\)\}/);
});

test('clear formatting takes off the text marks and a heading, and keeps lists, quotes and links', () => {
  const formatting = read('formatting.ts');
  assert.match(formatting, /\.unsetBold\(\)\s*\.unsetItalic\(\)\s*\.unsetUnderline\(\)\s*\.unsetStrike\(\)\s*\.unsetCode\(\);\s*if \(editor\.isActive\('heading'\)\) chain\.setParagraph\(\);/);
  assert.doesNotMatch(formatting, /unsetAllMarks|clearNodes|unsetLink/);
});

test('a computer gets the bar above the note, with tooltips; touch keeps the dock bar', () => {
  const screen = read('NoteEditorScreen.tsx');
  assert.match(screen, /\{editor && coarsePointer === false \? \(\s*<DesktopToolbar/);
  // Image and @case moved from the header row into the bar.
  assert.doesNotMatch(screen, /<ToolbarButton/);
  const bar = read('DesktopToolbar.tsx');
  assert.match(bar, /className="sticky top-0 z-20/);
  assert.match(bar, /label="Undo"\s*shortcut=\{keys\(UNDO_KEYS\)\}/);
  assert.match(bar, /label="Redo"\s*shortcut=\{keys\(REDO_KEYS\)\}/);
  assert.match(bar, /<StyleSelect editor=\{editor\} state=\{state\} mac=\{mac\} \/>/);
  assert.match(bar, /label=\{CLEAR_FORMATTING\.label\}\s*shortcut=\{keys\(CLEAR_FORMATTING\.keys\)\}/);
  // The tooltip names the control and its keys; without a shortcut the native title stays.
  const button = read('ToolbarButton.tsx');
  assert.match(button, /title=\{shortcut \? undefined : label\}/);
  assert.match(button, /<TooltipContent side="bottom" sideOffset=\{6\}>\s*<span>\{label\}<\/span>\s*<kbd/);
});

test('the phone bar holds nine controls and the rest is in More', () => {
  const bar = read('FormattingBar.tsx');
  const row = bar.slice(bar.indexOf('role="toolbar"'), bar.indexOf('<MoreMenu'));
  // Undo, redo, two marks, two lists, image, @case (eight buttons), then More. The
  // marks and the lists each render from one map, so the source has six tags.
  assert.equal((row.match(/<ToolbarButton/g) ?? []).length, 6);
  assert.match(bar, /const ROW_TEXT_VERBS = TEXT_VERBS\.filter\(\(\{ verb \}\) => verb === 'bold' \|\| verb === 'italic'\);/);
  assert.match(bar, /\{ROW_TEXT_VERBS\.map/);
  assert.match(bar, /\{LIST_VERBS\.map/);
  assert.match(bar, /<MoreMenu editor=\{editor\} state=\{state\} onLink=\{onLink\} \/>/);
  // More: the style, underline and strike, quote, code, link and clear formatting.
  const more = bar.slice(bar.indexOf('function MoreMenu'));
  for (const piece of [/STYLE_OPTIONS\.map/, /MORE_TEXT_VERBS\.map/, /QUOTE_VERB\.verb/, /CODE_VERB\.verb/, /'Add link'/, /CLEAR_FORMATTING\.label/]) {
    assert.match(more, piece);
  }
  // It opens above the bar, and hands focus back to the editor unless the link dialog takes it.
  assert.match(more, /side="top"/);
  assert.match(more, /if \(!toDialog\.current\) editor\.commands\.focus\(\);/);
});
