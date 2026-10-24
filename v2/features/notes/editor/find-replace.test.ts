import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getSchema } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState, type Command } from '@tiptap/pm/state';
import { history, undo } from '@tiptap/pm/history';

import { createNoteExtensions } from './extensions';
import {
  createFindPlugin,
  findCountLabel,
  findMatches,
  findNext,
  findPrevious,
  getFindState,
  isFindShortcut,
  replaceAll,
  replaceCurrent,
  selectionSeed,
  setFindQuery,
} from './find-replace';
import type { CaseMentionSnapshot, CaseMentionStore } from './mention-store';

/* Find and replace in notes (Arthur asked; Stay said "Yes build", 24 October
 * 2026). The matching and the replacing run on a real ProseMirror document
 * built from the note editor's own schema. */

const SNAPSHOT: CaseMentionSnapshot = {
  open: false,
  query: '',
  loading: false,
  failed: false,
  items: [],
  activeIndex: 0,
  anchor: null,
};
// The `@` picker's store is only called while the picker is open; the schema
// needs the extension, not a live store.
const stubStore: CaseMentionStore = {
  subscribe: () => () => undefined,
  getSnapshot: () => SNAPSHOT,
  getServerSnapshot: () => SNAPSHOT,
  start: () => undefined,
  update: () => undefined,
  exit: () => undefined,
  moveActive: () => undefined,
  setActive: () => undefined,
  choose: () => undefined,
  handleKeyDown: () => false,
  destroy: () => undefined,
};

const schema = getSchema(createNoteExtensions({ placeholder: '', mentionStore: stubStore }));

const text = (value: string, marks: string[] = []) => ({
  type: 'text',
  text: value,
  ...(marks.length > 0 ? { marks: marks.map((type) => ({ type })) } : {}),
});
const paragraph = (...content: object[]) => ({ type: 'paragraph', content });
const docOf = (...content: object[]) => schema.nodeFromJSON({ type: 'doc', content });

/** The matched text, in order. */
const matched = (doc: ProseMirrorNode, query: string, caseSensitive = false) =>
  findMatches(doc, query, caseSensitive).map(({ from, to }) => doc.textBetween(from, to));

/** A state with the find plugin and undo history, as in the editor. */
function stateOf(doc: ProseMirrorNode): EditorState {
  return EditorState.create({ doc, plugins: [history(), createFindPlugin()] });
}

function run(state: EditorState, command: Command): EditorState {
  let next = state;
  const done = command(state, (tr) => {
    next = state.apply(tr);
  });
  assert.equal(done, true);
  return next;
}

test('a match ignores case unless Match case is on', () => {
  const doc = docOf(paragraph(text('The court held. the Court agreed.')));
  assert.deepEqual(matched(doc, 'the court'), ['The court', 'the Court']);
  assert.deepEqual(matched(doc, 'the Court', true), ['the Court']);
  assert.deepEqual(matched(doc, ''), []);
  assert.deepEqual(matched(doc, 'tribunal'), []);
});

test('a word split by bold or italic still matches, and positions cover the whole word', () => {
  const doc = docOf(paragraph(text('Neg'), text('lig', ['bold']), text('ence', ['italic']), text(' and more')));
  assert.deepEqual(matched(doc, 'negligence'), ['Negligence']);
  const [range] = findMatches(doc, 'negligence', false);
  assert.deepEqual(range, { from: 1, to: 11 });
});

test('a match never runs across two paragraphs', () => {
  const doc = docOf(paragraph(text('end of one')), paragraph(text('start of two')));
  assert.deepEqual(matched(doc, 'onestart'), []);
  assert.deepEqual(matched(doc, 'one start'), []);
  assert.deepEqual(matched(doc, 'start'), ['start']);
});

test('a case mention chip breaks a match and is never searched inside', () => {
  const mention = { type: 'caseMention', attrs: { id: 7, slug: 'okafor-v-nweke', label: 'Okafor v. Nweke' } };
  const doc = docOf(paragraph(text('see '), mention, text(' held')));
  assert.deepEqual(matched(doc, 'okafor'), []);
  assert.deepEqual(matched(doc, 'see  held'), []);
  assert.deepEqual(matched(doc, 'held'), ['held']);
});

test('table cells are searched, each cell on its own', () => {
  const cell = (value: string) => ({ type: 'tableCell', content: [paragraph(text(value))] });
  const doc = docOf({ type: 'table', content: [{ type: 'tableRow', content: [cell('alpha'), cell('beta alpha')] }] });
  assert.deepEqual(matched(doc, 'alpha'), ['alpha', 'alpha']);
  assert.deepEqual(matched(doc, 'alphabeta'), []);
});

test('Replace all is one transaction: one undo brings every match back, and the marks stay', () => {
  const original = docOf(
    paragraph(text('claimant', ['bold']), text(' v defendant')),
    paragraph(text('the Claimant wins')),
  );
  let state = stateOf(original);
  state = run(state, setFindQuery('claimant', false));
  assert.equal(getFindState(state).matches.length, 2);

  state = run(state, replaceAll('appellant'));
  assert.equal(state.doc.textBetween(0, state.doc.content.size, '\n'), 'appellant v defendant\nthe appellant wins');
  const first = state.doc.firstChild?.firstChild;
  assert.equal(first?.text, 'appellant');
  assert.deepEqual(first?.marks.map((mark) => mark.type.name), ['bold']);
  assert.equal(getFindState(state).matches.length, 0);

  state = run(state, undo);
  assert.ok(state.doc.eq(original));
  assert.equal(getFindState(state).matches.length, 2);
});

test('Replace replaces the current match and moves to the next, and a replacement holding the query is not found again', () => {
  let state = stateOf(docOf(paragraph(text('cat cat cat'))));
  state = run(state, setFindQuery('cat', false));
  assert.equal(getFindState(state).current, 0);

  state = run(state, replaceCurrent('cats'));
  assert.equal(state.doc.textContent, 'cats cat cat');
  const after = getFindState(state);
  assert.equal(after.matches.length, 3);
  assert.equal(after.current, 1);
  assert.equal(state.doc.textBetween(after.matches[1].from, after.matches[1].to + 1), 'cat ');

  state = run(state, replaceCurrent(''));
  assert.equal(state.doc.textContent, 'cats  cat');
  const emptied = getFindState(state);
  assert.equal(emptied.matches.length, 2);
  assert.equal(emptied.current, 1);
  assert.equal(emptied.matches[1].from, 7);
});

test('next and previous wrap round, and the count reads "3 of 12", "No matches" or nothing', () => {
  let state = stateOf(docOf(paragraph(text('a b a b a'))));
  state = run(state, setFindQuery('a', false));
  assert.equal(getFindState(state).current, 0);
  state = run(state, findPrevious());
  assert.equal(getFindState(state).current, 2);
  state = run(state, findNext());
  assert.equal(getFindState(state).current, 0);

  assert.equal(findCountLabel('a', 12, 2), '3 of 12');
  assert.equal(findCountLabel('zz', 0, -1), 'No matches');
  assert.equal(findCountLabel('', 0, -1), '');
  assert.equal(selectionSeed(state), '');
});

test('the tints are decorations: the saved document has no find mark', () => {
  assert.deepEqual(
    Object.keys(schema.marks).filter((name) => /find|search/i.test(name)),
    [],
  );
});

test('Ctrl+F on Windows, ⌘F on a Mac, and no other chord opens the find bar', () => {
  const press = (key: string, keys: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>>) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...keys,
  });
  assert.equal(isFindShortcut(press('f', { ctrlKey: true }), false), true);
  assert.equal(isFindShortcut(press('F', { ctrlKey: true }), false), true);
  assert.equal(isFindShortcut(press('f', { metaKey: true }), true), true);
  assert.equal(isFindShortcut(press('f', { ctrlKey: true }), true), false);
  assert.equal(isFindShortcut(press('f', { metaKey: true }), false), false);
  assert.equal(isFindShortcut(press('f', { ctrlKey: true, shiftKey: true }), false), false);
  assert.equal(isFindShortcut(press('g', { ctrlKey: true }), false), false);
});

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the note editor and the draft panel open the bar on the find key, and only then hold it from the browser', () => {
  const screen = read('v2', 'features', 'notes', 'editor', 'NoteEditorScreen.tsx');
  assert.match(screen, /if \(!isFindShortcut\(event, mac\)\) return;\s*event\.preventDefault\(\);\s*openFind\(\);/);
  const draft = read('v2', 'features', 'conversations', 'conversation', 'draft', 'DraftEditor.tsx');
  assert.match(draft, /if \(!isFindShortcut\(event, mac\)\) return;\s*event\.preventDefault\(\);\s*openFind\(\);/);
  // On the panel's own element: Ctrl+F elsewhere on the chat page stays the browser's.
  assert.match(draft, /const frame = frameRef\.current;[^]*?frame\.addEventListener\('keydown', onKeyDown\);/);
  // On the note screen, while it is open.
  assert.match(screen, /window\.addEventListener\('keydown', onKeyDown\);/);
});

test('the phone menu, the computer bar and the draft panel each offer "Find and replace"', () => {
  assert.match(read('v2', 'features', 'notes', 'editor', 'FormattingBar.tsx'), /Find and replace\n/);
  assert.match(read('v2', 'features', 'notes', 'editor', 'DesktopToolbar.tsx'), /label="Find and replace"/);
  const draft = read('v2', 'features', 'conversations', 'conversation', 'draft', 'DraftEditor.tsx');
  const barMenu = draft.slice(draft.indexOf('function BarMoreMenu('));
  assert.match(barMenu, /Find and replace\n/);
  const sheetBar = draft.slice(draft.indexOf('function DraftToolbar('), draft.indexOf('function DraftBarTools('));
  assert.match(sheetBar, /label="Find and replace"/);
});

test('a read-only editor gets Find and no Replace', () => {
  const bar = read('v2', 'features', 'notes', 'editor', 'FindBar.tsx');
  assert.match(bar, /editable: instance\.isEditable/);
  // The chevron that opens the replace row, and the row itself, need an editable editor.
  assert.match(bar, /\{editable \? \(\s*<FindIconButton[^]*?label=\{replaceOpen \? 'Hide replace' : 'Show replace'\}/);
  assert.match(bar, /\{editable && replaceOpen \? \(/);
});

test('no new package: find and replace is built on the ProseMirror already installed', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  assert.deepEqual(names.filter((name) => /find|search|replace/i.test(name)), []);
  const source = read('v2', 'features', 'notes', 'editor', 'find-replace.ts');
  const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(imports)].sort(), ['@tiptap/core', '@tiptap/pm/model', '@tiptap/pm/state', '@tiptap/pm/view']);
});
