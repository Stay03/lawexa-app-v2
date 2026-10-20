import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMacPlatform, shortcutLabel } from './shortcut-label';
import {
  ALIGN_OPTIONS,
  BLOCK_VERBS,
  CLEAR_FORMATTING,
  CODE_VERB,
  REDO_KEYS,
  STYLE_OPTIONS,
  TABLE_EDITS,
  TABLE_INSERT,
  TEXT_VERBS,
  UNDO_KEYS,
  styleLabel,
} from './toolbar-verbs';

/* Arthur's editor step 1 (go 19 October 2026, 17:36Z; thread e04e8a92), the
 * toolbar part: undo and redo on a computer, a style dropdown, clear
 * formatting, tooltips with shortcuts, and a More menu on the phone. No new
 * package. Step 2 (20 October 2026) adds Large heading (H1) to the style,
 * one highlight, alignment and tables, with @tiptap/extension-table,
 * @tiptap/extension-text-align and @tiptap/extension-highlight, all 3.15.3. */

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
    highlight: 'Mod-Shift-h',
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
  // Highlight's own binding is Mod-Shift-h (Tiptap 3.15.3), and TextAlign's four.
  assert.match(extensions, /ClearFormattingShortcut,\n    Highlight\.configure\(\{ multicolor: false \}\),/);
  assert.deepEqual(ALIGN_OPTIONS.map((o) => `${o.align} ${o.keys}`), [
    'left Mod-Shift-l',
    'center Mod-Shift-e',
    'right Mod-Shift-r',
    'justify Mod-Shift-j',
  ]);
});

test('the style dropdown offers Normal text, Large heading, Heading and Subheading, and sets rather than toggles', () => {
  assert.deepEqual(STYLE_OPTIONS.map((o) => `${o.style} ${o.label} ${o.keys}`), [
    'paragraph Normal text Mod-Alt-0',
    'h1 Large heading Mod-Alt-1',
    'h2 Heading Mod-Alt-2',
    'h3 Subheading Mod-Alt-3',
  ]);
  assert.equal(styleLabel('h1'), 'Large heading');
  assert.equal(styleLabel('paragraph'), 'Normal text');
  const formatting = read('formatting.ts');
  assert.match(
    formatting,
    /if \(style === 'paragraph'\) chain\.setParagraph\(\)\.run\(\);\s*else chain\.setHeading\(\{ level: style === 'h1' \? 1 : style === 'h2' \? 2 : 3 \}\)\.run\(\);/,
  );
  assert.match(read('StyleSelect.tsx'), /onSelect=\{\(\) => applyStyle\(editor, option\.style\)\}/);
});

test('clear formatting takes off the text marks, the highlight and a heading, and keeps lists, quotes, links and alignment', () => {
  const formatting = read('formatting.ts');
  assert.match(
    formatting,
    /\.unsetBold\(\)\s*\.unsetItalic\(\)\s*\.unsetUnderline\(\)\s*\.unsetStrike\(\)\s*\.unsetCode\(\)\s*\.unsetHighlight\(\);\s*if \(editor\.isActive\('heading'\)\) chain\.setParagraph\(\);/,
  );
  // The keyboard shortcut follows the same rule as the button.
  assert.match(
    read('extensions.ts'),
    /\.unsetCode\(\)\s*\.unsetHighlight\(\);\s*if \(this\.editor\.isActive\('heading'\)\) chain\.setParagraph\(\);/,
  );
  const clear = formatting.slice(formatting.indexOf('export function clearFormatting'), formatting.indexOf('export function applyStyle'));
  assert.doesNotMatch(clear, /unsetAllMarks|clearNodes|unsetLink|unsetTextAlign/);
});

test('the highlight is a plain mark with one colour, and alignment never stores left', () => {
  const extensions = read('extensions.ts');
  // One colour: multicolor off, so a <mark> carries no colour attribute.
  assert.match(extensions, /import Highlight from '@tiptap\/extension-highlight';/);
  assert.doesNotMatch(extensions, /multicolor: true/);
  // Still no colour, text-style or font package.
  assert.doesNotMatch(extensions, /from '@tiptap\/extension-(color|text-style|font)/);
  assert.match(extensions, /TextAlign\.configure\(\{\s*types: \['heading', 'paragraph'\],/);
  // A dragged column width is a style the reader drops, so tables do not resize.
  assert.match(extensions, /TableKit\.configure\(\{ table: false \}\),\s*EditorTable\.configure\(\{ resizable: false \}\),/);
  // The table is drawn by Tiptap's TableView, which redraws its columns after a
  // column is deleted and gives a wide table its own sideways scroll (Tester,
  // 20 October 2026).
  assert.match(extensions, /addNodeView\(\) \{\s*return \(\{ node \}\) => new TableView\(node, this\.options\.cellMinWidth\);/);
  const screen = read('NoteEditorScreen.tsx');
  assert.match(screen, /\[&_\.tableWrapper\]:overflow-x-auto/);
  assert.match(screen, /\[&_td\]:min-w-\[6em\]/);
  assert.doesNotMatch(screen, /\[&_table\]:table-fixed/);
  // Inline code shows no backticks (the typography plugin adds them).
  assert.match(screen, /\[&_code\]:before:content-none \[&_code\]:after:content-none/);
  assert.match(
    read('formatting.ts'),
    /if \(align === 'left'\) chain\.unsetTextAlign\(\)\.run\(\);\s*else chain\.setTextAlign\(align\)\.run\(\);/,
  );
});

test('the table menu inserts outside a table and edits inside one, removals last', () => {
  assert.equal(TABLE_INSERT.action, 'insert');
  assert.deepEqual(
    TABLE_EDITS.map((group) => group.map((item) => item.action)),
    [['rowBefore', 'rowAfter', 'columnBefore', 'columnAfter'], ['headerRow'], ['deleteRow', 'deleteColumn', 'deleteTable']],
  );
  assert.ok(TABLE_EDITS[2].every((item) => item.removes));
  assert.ok(TABLE_EDITS.slice(0, 2).flat().every((item) => !item.removes));
  assert.match(read('formatting.ts'), /chain\.insertTable\(\{ rows: 3, cols: 3, withHeaderRow: true \}\)\.run\(\);/);
  const menu = read('TableMenu.tsx');
  assert.match(menu, /if \(!state\.inTable\) \{/);
  assert.match(menu, /variant=\{item\.removes \? 'destructive' : 'default'\}/);
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
  assert.match(bar, /<AlignMenu editor=\{editor\} state=\{state\} mac=\{mac\} \/>/);
  assert.match(bar, /<TableMenu editor=\{editor\} state=\{state\} \/>/);
  // One row at 1440 px (techlead, 20 October 2026): 32 px controls, menu icons without a chevron,
  // and inline code and clear formatting in a More menu with their keys.
  assert.equal((bar.match(/<ToolbarButton\s+compact/g) ?? []).length, (bar.match(/<ToolbarButton/g) ?? []).length);
  for (const menu of ['AlignMenu.tsx', 'TableMenu.tsx']) {
    assert.doesNotMatch(read(menu), /ChevronDown/);
    assert.match(read(menu), /DESKTOP_MENU_TRIGGER/);
  }
  const more = bar.slice(bar.indexOf('function DesktopMoreMenu'));
  assert.match(more, /runFormat\(editor, CODE_VERB\.verb\)/);
  assert.match(more, /runFormat\(editor, CLEAR_FORMATTING\.verb\)/);
  assert.match(more, /shortcutLabel\(CLEAR_FORMATTING\.keys, mac\)/);
  assert.match(read('ToolbarButton.tsx'), /compact \? 'size-8' : 'size-9'/);
  // Every computer-bar button has a tooltip naming it, with its keys when it has
  // any (Tester, 20 October 2026: Link, Image and @case had none). Only the
  // phone bar, which passes neither, keeps the native title.
  const button = read('ToolbarButton.tsx');
  assert.match(button, /const tooltip = compact \|\| shortcut !== undefined;/);
  assert.match(button, /title=\{tooltip \? undefined : label\}/);
  assert.match(button, /<TooltipContent side="bottom" sideOffset=\{6\}>\s*<span>\{label\}<\/span>\s*\{shortcut \? <kbd/);
  // A greyed Redo still shows its tooltip: `aria-disabled` keeps the pointer.
  assert.match(button, /disabled=\{tooltip \? undefined : disabled\}/);
  assert.match(button, /aria-disabled=\{tooltip && disabled \? true : undefined\}/);
  assert.match(button, /onClick=\{disabled \? undefined : onPress\}/);
  // The style box fits its longest name ("Large heading") without an ellipsis.
  assert.match(read('StyleSelect.tsx'), /h-8 w-36 shrink-0/);
});

test('the phone bar holds nine controls and the rest is in More', () => {
  const bar = read('FormattingBar.tsx');
  const row = bar.slice(bar.indexOf('role="toolbar"'), bar.indexOf('<MoreMenu'));
  // Undo, redo, two marks, two lists, image, @case (eight buttons), then More. The
  // marks and the lists each render from one map, so the source has six tags.
  assert.equal((row.match(/<ToolbarButton/g) ?? []).length, 6);
  assert.match(bar, /const ROW_TEXT_VERBS = TEXT_VERBS\.filter\(\(\{ verb \}\) => verb === 'bold' \|\| verb === 'italic'\);/);
  assert.match(bar, /const MORE_TEXT_VERBS = TEXT_VERBS\.filter\(\(\{ verb \}\) => verb !== 'bold' && verb !== 'italic'\);/);
  assert.match(bar, /\{ROW_TEXT_VERBS\.map/);
  assert.match(bar, /\{LIST_VERBS\.map/);
  assert.match(bar, /<MoreMenu editor=\{editor\} state=\{state\} onLink=\{onLink\} \/>/);
  // More: the style, underline, strike and highlight, quote, code, alignment, the table, link and clear formatting.
  const more = bar.slice(bar.indexOf('function MoreMenu'));
  for (const piece of [
    /STYLE_OPTIONS\.map/,
    /MORE_TEXT_VERBS\.map/,
    /QUOTE_VERB\.verb/,
    /CODE_VERB\.verb/,
    /ALIGN_OPTIONS\.map/,
    /<TableMenuItems editor=\{editor\} state=\{state\} \/>/,
    /'Add link'/,
    /CLEAR_FORMATTING\.label/,
  ]) {
    assert.match(more, piece);
  }
  // It opens above the bar, and hands focus back to the editor unless the link dialog takes it.
  assert.match(more, /side="top"/);
  assert.match(more, /if \(!toDialog\.current\) editor\.commands\.focus\(\);/);
});
