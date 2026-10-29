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
  FIND_DEFAULTS,
  findCountLabel,
  findMatches,
  findNext,
  findPrevious,
  getFindState,
  isFindShortcut,
  keepCase,
  replaceAll,
  replaceCurrent,
  selectionSeed,
  setFindQuery,
  standsAlone,
  type FindOptions,
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

/** Match case on, Whole word off. */
const CASE: FindOptions = { caseSensitive: true, wholeWord: false };
/** Whole word on, Match case off. */
const WORD: FindOptions = { caseSensitive: false, wholeWord: true };
/** Both on. */
const CASE_WORD: FindOptions = { caseSensitive: true, wholeWord: true };

/** The matched text, in order. */
const matched = (doc: ProseMirrorNode, query: string, options: FindOptions = FIND_DEFAULTS) =>
  findMatches(doc, query, options).map(({ from, to }) => doc.textBetween(from, to));

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
  assert.deepEqual(matched(doc, 'the Court', CASE), ['the Court']);
  assert.deepEqual(matched(doc, ''), []);
  assert.deepEqual(matched(doc, 'tribunal'), []);
});

test('a word split by bold or italic still matches, and positions cover the whole word', () => {
  const doc = docOf(paragraph(text('Neg'), text('lig', ['bold']), text('ence', ['italic']), text(' and more')));
  assert.deepEqual(matched(doc, 'negligence'), ['Negligence']);
  const [range] = findMatches(doc, 'negligence', FIND_DEFAULTS);
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
  state = run(state, setFindQuery('claimant', FIND_DEFAULTS));
  assert.equal(getFindState(state).matches.length, 2);

  state = run(state, replaceAll('appellant'));
  // "Claimant" keeps its capital (Lucy, 25 October 2026).
  assert.equal(state.doc.textBetween(0, state.doc.content.size, '\n'), 'appellant v defendant\nthe Appellant wins');
  const first = state.doc.firstChild?.firstChild;
  assert.equal(first?.text, 'appellant');
  assert.deepEqual(first?.marks.map((mark) => mark.type.name), ['bold']);
  assert.equal(getFindState(state).matches.length, 0);

  state = run(state, undo);
  assert.ok(state.doc.eq(original));
  assert.equal(getFindState(state).matches.length, 2);
});

test('Whole word: "court" is not found inside "Courtroom", and is found before an apostrophe or inside brackets', () => {
  // Lucy's case (Stay, 29 October 2026).
  const doc = docOf(paragraph(text("The Courtroom emptied. The court's order (court) stood; courts, Court.")));
  assert.deepEqual(matched(doc, 'court'), ['Court', 'court', 'court', 'court', 'Court']);
  assert.deepEqual(matched(doc, 'court', WORD), ['court', 'court', 'Court']);
  assert.deepEqual(matched(doc, 'court', CASE_WORD), ['court', 'court']);
  assert.deepEqual(matched(doc, 'Court', CASE_WORD), ['Court']);
  // Off by default: Whole word changes nothing until it is on.
  assert.deepEqual(matched(doc, 'court', CASE), ['court', 'court', 'court']);
});

test('Whole word knows letters in every script: an accented or non-Latin letter is part of the word', () => {
  // "é" written as one character, then as "e" with a combining accent: both are letters of the word.
  const doc = docOf(paragraph(text('café cafe\u0301 cafe. Straße strasse. 1court court1 _court_ αcourt court—')));
  assert.deepEqual(matched(doc, 'caf', WORD), []);
  assert.deepEqual(matched(doc, 'cafe', WORD), ['cafe']);
  assert.deepEqual(matched(doc, 'straße', WORD), ['Straße']);
  // A digit or a Greek letter touching it makes it part of a longer word; an underscore or a dash does not.
  assert.deepEqual(matched(doc, 'court', WORD), ['court', 'court']);
  // A letter outside the Basic Multilingual Plane (two UTF-16 units) is still one letter.
  const wide = docOf(paragraph(text('𝐀court court𝐀 court')));
  assert.deepEqual(matched(wide, 'court', WORD), ['court']);
  assert.equal(standsAlone('a court b', 2, 7), true);
  assert.equal(standsAlone('courtroom', 0, 5), false);
});

test('Whole word looks again inside a rejected candidate ("a a" in "ba a a"), and a block edge or a chip is a word edge', () => {
  // "a a" at 1 touches "b"; the one at 3 stands alone, and starts inside the first.
  const overlapping = docOf(paragraph(text('ba a a')));
  assert.deepEqual(findMatches(overlapping, 'a a', WORD).map(({ from }) => from - 1), [3]);
  const doc = docOf(
    paragraph(text('court')),
    paragraph(text('see '), { type: 'caseMention', attrs: { id: 7, slug: 'okafor-v-nweke', label: 'Okafor v. Nweke' } }, text('court ruled')),
  );
  assert.deepEqual(matched(doc, 'court', WORD), ['court', 'court']);
});

test('Replace all with Whole word: only whole words change, in one undo, keeping their capitals', () => {
  const original = docOf(paragraph(text("The Courtroom: the Court's order. (court) courts")));
  let state = stateOf(original);
  state = run(state, setFindQuery('court', WORD));
  assert.equal(getFindState(state).matches.length, 2);
  state = run(state, replaceAll('tribunal'));
  assert.equal(state.doc.textContent, "The Courtroom: the Tribunal's order. (tribunal) courts");
  state = run(state, undo);
  assert.ok(state.doc.eq(original));

  // With Match case on too, only "court" in lower case, put in as typed.
  let exact = stateOf(original);
  exact = run(exact, setFindQuery('court', CASE_WORD));
  exact = run(exact, replaceAll('tribunal'));
  assert.equal(exact.doc.textContent, "The Courtroom: the Court's order. (tribunal) courts");
});

test('Replace with Whole word replaces the current whole word and moves to the next, skipping "Courtroom"', () => {
  let state = stateOf(docOf(paragraph(text('court Courtroom Court'))));
  state = run(state, setFindQuery('court', WORD));
  assert.equal(getFindState(state).matches.length, 2);
  state = run(state, replaceCurrent('bench'));
  assert.equal(state.doc.textContent, 'bench Courtroom Court');
  assert.equal(getFindState(state).matches.length, 1);
  state = run(state, replaceCurrent('bench'));
  assert.equal(state.doc.textContent, 'bench Courtroom Bench');
});

test('a replacement keeps the capitals of the text it replaces', () => {
  // Lucy, 25 October 2026: replacing "court" turned "Court" into "court".
  assert.equal(keepCase('court', 'tribunal'), 'tribunal');
  assert.equal(keepCase('Court', 'tribunal'), 'Tribunal');
  assert.equal(keepCase('COURT', 'tribunal'), 'TRIBUNAL');
  // Two words: the first letter only, or all capitals.
  assert.equal(keepCase('High court', 'lower court'), 'Lower court');
  assert.equal(keepCase('HIGH COURT', 'lower court'), 'LOWER COURT');
  // A lone capital letter is a capital first letter, not "all capitals".
  assert.equal(keepCase('I', 'we'), 'We');
  assert.equal(keepCase('A', 'an'), 'An');
  // Punctuation and digits around the letters do not count.
  assert.equal(keepCase('"Court"', 'tribunal'), 'Tribunal');
  assert.equal(keepCase('s20(4)', 'section'), 'section');
  assert.equal(keepCase('20', 'twenty'), 'twenty');
  // A replacement typed with capitals of its own goes in as typed (the techlead, 28 October 2026).
  assert.equal(keepCase('court', 'SEC'), 'SEC');
  assert.equal(keepCase('COURT', 'McDonald'), 'McDonald');
  assert.equal(keepCase('Court', 'iPhone'), 'iPhone');
  // Other scripts.
  assert.equal(keepCase('Éclair', 'gâteau'), 'Gâteau');
  assert.equal(keepCase('STRASSE', 'straße'), 'STRASSE');
});

test('Replace all keeps each match’s capitals with Match case off, and puts it in as typed with it on', () => {
  const sentence = () => docOf(paragraph(text('The Court held that the court below erred, and the COURT of Appeal agreed.')));
  let state = stateOf(sentence());
  state = run(state, setFindQuery('court', FIND_DEFAULTS));
  state = run(state, replaceAll('tribunal'));
  assert.equal(state.doc.textContent, 'The Tribunal held that the tribunal below erred, and the TRIBUNAL of Appeal agreed.');
  // Still one undo for all three.
  state = run(state, undo);
  assert.ok(state.doc.eq(sentence()));

  // Match case on: only the exact "court" matches, and the replacement goes in as typed.
  let exact = stateOf(sentence());
  exact = run(exact, setFindQuery('Court', CASE));
  exact = run(exact, replaceAll('tribunal'));
  assert.equal(exact.doc.textContent, 'The tribunal held that the court below erred, and the COURT of Appeal agreed.');
});

test('Replace keeps the capitals too, and moves on past what it wrote even when capitals change its length', () => {
  let state = stateOf(docOf(paragraph(text('Strasse strasse'))));
  state = run(state, setFindQuery('strasse', FIND_DEFAULTS));
  state = run(state, replaceCurrent('straße'));
  // "Strasse" has a capital first letter: "Straße".
  assert.equal(state.doc.textContent, 'Straße strasse');
  assert.equal(getFindState(state).current, 0);
  assert.equal(getFindState(state).matches.length, 1);

  let shouting = stateOf(docOf(paragraph(text('STRASSE strasse'))));
  shouting = run(shouting, setFindQuery('strasse', FIND_DEFAULTS));
  shouting = run(shouting, replaceCurrent('straße'));
  // In capitals "straße" is "STRASSE", one letter longer, and the next match is still the second word.
  assert.equal(shouting.doc.textContent, 'STRASSE strasse');
  const next = getFindState(shouting);
  assert.equal(shouting.doc.textBetween(next.matches[next.current].from, next.matches[next.current].to), 'strasse');
});

test('Replace replaces the current match and moves to the next, and a replacement holding the query is not found again', () => {
  let state = stateOf(docOf(paragraph(text('cat cat cat'))));
  state = run(state, setFindQuery('cat', FIND_DEFAULTS));
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
  state = run(state, setFindQuery('a', FIND_DEFAULTS));
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
  // Plus its own scroll helper (scroll-to-match.ts) and the hidden readout (find-debug.ts).
  assert.deepEqual([...new Set(imports)].sort(), ['./find-debug', './scroll-to-match', '@tiptap/core', '@tiptap/pm/model', '@tiptap/pm/state', '@tiptap/pm/view']);
  const helperImports = [...read('v2', 'features', 'notes', 'editor', 'scroll-to-match.ts').matchAll(/from '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(helperImports, ['./find-debug']);
});

test('the match tints are neutral greys, never a colour (no coloured accents; the techlead, 24 October 2026)', () => {
  const css = read('v2', 'features', 'notes', 'editor', 'find-replace.css');
  const colours = css.match(/oklch\([^)]*\)/g) ?? [];
  assert.equal(colours.length, 6);
  // Every oklch has zero chroma and zero hue: a grey, in light and dark.
  for (const colour of colours) assert.match(colour, /^oklch\([\d.]+ 0 0 \/ [\d.]+\)$/, colour);
  assert.match(css, /\.v2-find-current \{\s*background-color: var\(--v2-find-current\);\s*box-shadow: inset 0 -1px 0 var\(--v2-find-current-line\);/);
});

test('the bar has a Whole word toggle beside Match case, off as it opens, and both search with the same options', () => {
  const bar = read('v2', 'features', 'notes', 'editor', 'FindBar.tsx');
  assert.match(bar, /const \[options, setOptions\] = useState<FindOptions>\(FIND_DEFAULTS\);/);
  assert.match(bar, /label="Match case"\s*pressed=\{options\.caseSensitive\}\s*onPress=\{\(\) => toggle\('caseSensitive'\)\}\s*\/>\s*<FindIconButton\s*layout=\{layout\}\s*icon=\{WholeWord\}\s*label="Whole word"\s*pressed=\{options\.wholeWord\}\s*onPress=\{\(\) => toggle\('wholeWord'\)\}/);
  assert.match(bar, /runFind\(editor, setFindQuery\(value, options\)\);/);
  assert.match(bar, /runFind\(editor, setFindQuery\(query, next\)\);/);
  assert.equal(FIND_DEFAULTS.wholeWord, false);
  // The box keeps room for the count and no more, so the words typed stay in view on a phone.
  assert.doesNotMatch(bar, /pr-24/);
  assert.match(bar, /style=\{count \? \{ paddingRight: `calc\(\$\{count\.length\}ch \+ 1rem\)` \} : undefined\}/);
});
