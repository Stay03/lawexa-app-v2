import { Extension, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Command, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { findDebugEnabled, recordFindStep, viewportLine } from './find-debug';
import { scrollMatchToMiddle } from './scroll-to-match';

/**
 * find-replace — find and replace in a note's body (Arthur asked; Stay said
 * "Yes build", 24 October 2026). Used by the note editor and the chat's draft
 * panel, which share `createNoteExtensions()`.
 *
 * ── TINTS ARE DECORATIONS, NEVER MARKS ──────────────────────────────────────
 * Every match is painted with a ProseMirror decoration: a class on a span the
 * view draws and the document never holds. `getHTML()` and the autosave never
 * see it, so a tint can not be saved into a note. No mark is added to the
 * schema (extensions.ts keeps "no colour" by the absence of any colour mark).
 *
 * ── WHAT A MATCH IS ─────────────────────────────────────────────────────────
 * A match lies inside one text block: a paragraph, a heading, a list item's
 * paragraph, a table cell's paragraph. The block's text is read across its
 * text nodes, so a word half in bold still matches. A case mention chip, an
 * image or a line break is a wall: nothing is searched inside it and no match
 * runs across it. Two blocks never join into one match.
 *
 * ── REPLACING ───────────────────────────────────────────────────────────────
 * A replacement is an ordinary edit: it goes through the editor, so undo and
 * the autosave see it like typing. It takes the marks of the text where the
 * match starts, so a bold word stays bold. Replace all is ONE transaction, so
 * one undo brings every match back. With Match case off, each replacement
 * keeps the capitals of the text it replaces (`keepCase`).
 */

/** One match, as document positions. */
export interface FindRange {
  from: number;
  to: number;
}

/** What the find plugin holds for one editor. */
export interface FindState {
  query: string;
  caseSensitive: boolean;
  matches: readonly FindRange[];
  /** The index of the current match in `matches`, or -1 when there is none. */
  current: number;
  decorations: DecorationSet;
  /** Moves when the current match was chosen by the reader, so the view scrolls to it. */
  scroll: number;
}

type FindMeta =
  | { type: 'query'; query: string; caseSensitive: boolean; from: number }
  | { type: 'step'; delta: 1 | -1 }
  | { type: 'after'; pos: number };

export const findReplaceKey = new PluginKey<FindState>('v2FindReplace');

/** The class on every match, and the one added to the current match (find-replace.css). */
export const FIND_MATCH_CLASS = 'v2-find-match';
export const FIND_CURRENT_CLASS = 'v2-find-current';

/**
 * Lower case one character at a time, keeping any character whose lower case
 * has another length (Turkish dotted I), so an index in the folded text is an
 * index in the document's text.
 */
function fold(text: string): string {
  let out = '';
  for (const character of text) {
    const lower = character.toLowerCase();
    out += lower.length === character.length ? lower : character;
  }
  return out;
}

/** Every match of `query` in the document, in document order, none overlapping. */
export function findMatches(doc: ProseMirrorNode, query: string, caseSensitive: boolean): FindRange[] {
  if (query.length === 0) return [];
  const needle = caseSensitive ? query : fold(query);
  const matches: FindRange[] = [];

  const search = (start: number, text: string) => {
    if (text.length < needle.length) return;
    const haystack = caseSensitive ? text : fold(text);
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      matches.push({ from: start + index, to: start + index + needle.length });
      index = haystack.indexOf(needle, index + needle.length);
    }
  };

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // One run of adjacent text nodes; a non-text inline node (mention, image,
    // line break) ends it.
    let runStart = -1;
    let runText = '';
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        if (runStart === -1) runStart = pos + 1 + offset;
        runText += child.text;
        return;
      }
      if (runStart !== -1) search(runStart, runText);
      runStart = -1;
      runText = '';
    });
    if (runStart !== -1) search(runStart, runText);
    return false;
  });

  return matches;
}

/** The first match that starts at or after `pos`, wrapping to the first; -1 when there are none. */
function firstFrom(matches: readonly FindRange[], pos: number): number {
  if (matches.length === 0) return -1;
  const index = matches.findIndex((match) => match.from >= pos);
  return index === -1 ? 0 : index;
}

function decorate(doc: ProseMirrorNode, matches: readonly FindRange[], current: number): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty;
  return DecorationSet.create(
    doc,
    matches.map((match, index) =>
      Decoration.inline(match.from, match.to, {
        class: index === current ? `${FIND_MATCH_CLASS} ${FIND_CURRENT_CLASS}` : FIND_MATCH_CLASS,
      }),
    ),
  );
}

function build(
  doc: ProseMirrorNode,
  query: string,
  caseSensitive: boolean,
  pickCurrent: (matches: readonly FindRange[]) => number,
  scroll: number,
): FindState {
  const matches = findMatches(doc, query, caseSensitive);
  const current = pickCurrent(matches);
  return { query, caseSensitive, matches, current, decorations: decorate(doc, matches, current), scroll };
}

const EMPTY: FindState = {
  query: '',
  caseSensitive: false,
  matches: [],
  current: -1,
  decorations: DecorationSet.empty,
  scroll: 0,
};

function applyFind(tr: Transaction, previous: FindState): FindState {
  const meta = tr.getMeta(findReplaceKey) as FindMeta | undefined;
  if (meta?.type === 'query') {
    return build(tr.doc, meta.query, meta.caseSensitive, (matches) => firstFrom(matches, meta.from), previous.scroll + 1);
  }
  if (meta?.type === 'after') {
    return build(tr.doc, previous.query, previous.caseSensitive, (matches) => firstFrom(matches, meta.pos), previous.scroll + 1);
  }
  if (meta?.type === 'step') {
    const total = previous.matches.length;
    if (total === 0) return previous;
    const current = (previous.current + meta.delta + total) % total;
    return { ...previous, current, decorations: decorate(tr.doc, previous.matches, current), scroll: previous.scroll + 1 };
  }
  if (!tr.docChanged || previous.query.length === 0) return previous;
  // The reader typed while the bar is open: the matches follow the text, and
  // the current one stays where it was, without scrolling.
  const was = previous.matches[previous.current];
  const anchor = was ? tr.mapping.map(was.from, -1) : 0;
  return build(tr.doc, previous.query, previous.caseSensitive, (matches) => firstFrom(matches, anchor), previous.scroll);
}

/** The plugin itself; the extension below adds it to an editor, the tests to a bare state. */
export function createFindPlugin(): Plugin<FindState> {
  return new Plugin<FindState>({
    key: findReplaceKey,
    state: {
      init: () => EMPTY,
      apply: applyFind,
    },
    props: {
      decorations: (state) => findReplaceKey.getState(state)?.decorations ?? DecorationSet.empty,
    },
    view: () => ({
      update: (view, previousState) => {
        const next = findReplaceKey.getState(view.state);
        const before = findReplaceKey.getState(previousState);
        if (!next || !before || next.scroll === before.scroll) return;
        // The current match is drawn by now; bring it to the middle of the
        // area the text scrolls in, by that area's scrollTop (scroll-to-match.ts:
        // iOS Safari did not move the draft for scrollIntoView). In the chat
        // draft that area is only the text between its bars and Save, so the
        // middle is in sight above an iPhone keyboard too (DraftEditor).
        const element = view.dom.querySelector(`.${FIND_CURRENT_CLASS}`);
        const count = `${next.current + 1} of ${next.matches.length}`;
        if (element instanceof HTMLElement) scrollMatchToMiddle(element, count);
        else if (findDebugEnabled()) {
          // The hidden readout (find-debug.ts): the count moved but no match was drawn.
          recordFindStep({
            count: `${count} (no match drawn)`,
            match: '-',
            area: '-',
            before: null,
            set: null,
            readBack: null,
            later: null,
            size: '-',
            viewport: viewportLine(),
            focus: document.activeElement?.tagName.toLowerCase() ?? 'none',
          });
        }
      },
    }),
  });
}

/** The extension that carries the plugin; added by `createNoteExtensions()`. */
export const FindReplace = Extension.create({
  name: 'findReplace',
  addProseMirrorPlugins() {
    return [createFindPlugin()];
  },
});

/** The plugin's state, or the empty one for an editor without it. */
export function getFindState(state: EditorState): FindState {
  return findReplaceKey.getState(state) ?? EMPTY;
}

/** Search for `query`; the current match is the first at or after the caret. */
export function setFindQuery(query: string, caseSensitive: boolean): Command {
  return (state, dispatch) => {
    if (dispatch) {
      const meta: FindMeta = { type: 'query', query, caseSensitive, from: state.selection.from };
      dispatch(state.tr.setMeta(findReplaceKey, meta));
    }
    return true;
  };
}

/** Clear the query, the count and every tint. */
export function clearFind(): Command {
  return setFindQuery('', false);
}

function step(delta: 1 | -1): Command {
  return (state, dispatch) => {
    if (getFindState(state).matches.length === 0) return false;
    if (dispatch) {
      const meta: FindMeta = { type: 'step', delta };
      dispatch(state.tr.setMeta(findReplaceKey, meta));
    }
    return true;
  };
}

/** Move to the next match, wrapping at the end. */
export function findNext(): Command {
  return step(1);
}

/** Move to the previous match, wrapping at the start. */
export function findPrevious(): Command {
  return step(-1);
}

/** A letter in any script. */
const LETTER = /\p{L}/u;

/**
 * The replacement, written with the capitals of the text it replaces (Lucy, 25
 * October 2026: replacing "court" turned "Court" into "court"): found in
 * capitals (two letters or more), the replacement goes in capitals; found
 * with a capital first letter, the replacement's first letter is a capital;
 * otherwise it goes in as typed. A replacement typed with any capital of its
 * own ("SEC", "McDonald") goes in exactly as typed: the reader chose those
 * capitals (the techlead, 28 October 2026). Only used with Match case off;
 * with it on, every replacement goes in as typed.
 */
export function keepCase(found: string, replacement: string): string {
  if (replacement !== replacement.toLowerCase()) return replacement;
  const letters = [...found].filter((character) => LETTER.test(character));
  if (letters.length === 0) return replacement;
  const word = letters.join('');
  if (letters.length >= 2 && word === word.toUpperCase() && word !== word.toLowerCase()) {
    return replacement.toUpperCase();
  }
  const first = letters[0];
  if (first === first.toLowerCase() || first !== first.toUpperCase()) return replacement;
  const characters = [...replacement];
  const index = characters.findIndex((character) => LETTER.test(character));
  if (index === -1) return replacement;
  characters[index] = characters[index].toUpperCase();
  return characters.join('');
}

/**
 * Put `text` over one match, with the marks of the match's first character
 * and, with Match case off, the capitals of the text it replaces. Returns the
 * length written, which capitals can change ("ß" in capitals is "SS").
 */
function replaceRange(tr: Transaction, range: FindRange, text: string, caseSensitive: boolean): number {
  if (text.length === 0) {
    tr.delete(range.from, range.to);
    return 0;
  }
  const written = caseSensitive ? text : keepCase(tr.doc.textBetween(range.from, range.to), text);
  const marks = tr.doc.nodeAt(range.from)?.marks ?? [];
  tr.replaceWith(range.from, range.to, tr.doc.type.schema.text(written, marks));
  return written.length;
}

/** Replace the current match and move to the next one after it. */
export function replaceCurrent(text: string): Command {
  return (state, dispatch) => {
    const find = getFindState(state);
    const match = find.matches[find.current];
    if (!match) return false;
    if (dispatch) {
      const tr = state.tr;
      const written = replaceRange(tr, match, text, find.caseSensitive);
      // The next match starts after the new text, so a replacement that
      // contains the query is not found again.
      const meta: FindMeta = { type: 'after', pos: match.from + written };
      dispatch(tr.setMeta(findReplaceKey, meta));
    }
    return true;
  };
}

/** Replace every match in one transaction, so one undo restores them all. */
export function replaceAll(text: string): Command {
  return (state, dispatch) => {
    const { matches, caseSensitive } = getFindState(state);
    if (matches.length === 0) return false;
    if (dispatch) {
      const tr = state.tr;
      // Last first, so the earlier positions still hold.
      for (let index = matches.length - 1; index >= 0; index -= 1) {
        replaceRange(tr, matches[index], text, caseSensitive);
      }
      const meta: FindMeta = { type: 'after', pos: 0 };
      dispatch(tr.setMeta(findReplaceKey, meta));
    }
    return true;
  };
}

/** Run a find command on a Tiptap editor. */
export function runFind(editor: Editor, command: Command): boolean {
  return command(editor.state, editor.view.dispatch);
}

/** "3 of 12", "No matches", or nothing while the find box is empty. */
export function findCountLabel(query: string, total: number, current: number): string {
  if (query.length === 0) return '';
  if (total === 0) return 'No matches';
  return `${current + 1} of ${total}`;
}

/**
 * The selected words, to start the find box with: only a short selection
 * inside one block. Anything longer is not what the reader means to search.
 */
export function selectionSeed(state: EditorState): string {
  const { from, to, empty, $from, $to } = state.selection;
  if (empty || $from.parent !== $to.parent || to - from > 100) return '';
  return state.doc.textBetween(from, to, ' ', ' ');
}

/**
 * Ctrl+F, or ⌘F on a Mac: the find bar's key. Only that chord, so Ctrl+Shift+F
 * and the browser's other keys stay the browser's.
 */
export function isFindShortcut(
  event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  mac: boolean,
): boolean {
  const modifier = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return modifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f';
}
