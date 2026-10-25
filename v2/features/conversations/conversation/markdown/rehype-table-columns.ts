import type { Element, ElementContent, Root, RootContent } from 'hast';

/**
 * rehype-table-columns — marks the columns of a chat answer's table so the
 * table can set them right (Stay, 25 October 2026: "a more cleaner,
 * professional ui/ux table that is beautifull and functional").
 *
 * Three marks, each decided per COLUMN from its body cells:
 *  - `v2-cell-num`: every filled body cell is a number, an amount, a size or a
 *    date. The column is right-aligned in tabular figures and never wraps, so
 *    digits line up down the column.
 *  - `v2-cell-long`: a body cell holds prose (a long run of words). The column
 *    gets a readable minimum width and wraps inside it, so a description is a
 *    short paragraph, not one endless line that pushes the table sideways.
 *  - `v2-cell-token`: a body cell holds a long run with no spaces (a file
 *    name). It stays on one line, except in a narrow table's kept first column,
 *    where it wraps at its own separators (the `<wbr>` below).
 * A column the answer aligned itself (`| ---: |`, `align` on the cell) keeps
 * its own alignment and gets no number mark. A table of four columns or more
 * is marked `v2-table-wide` (Stay, 26 October 2026: on a phone its first
 * column stays in place while the rest scroll).
 *
 * The walk reads only text, so it works the same on the plain pipeline and on
 * the streaming one (word spans are text inside spans). A table still streaming
 * is marked again on every flush; the marks only ever change with its cells.
 */

/** A number, an amount, a percentage, a size: 12 · 1,229 · ₦50,000.00 · -3.5% · 18 KB. */
const NUMBER = /^[-+−]?[₦$£€]?\s?\d[\d,]*(\.\d+)?\s?(%|[KMG]?B|kb|mb|gb)?$/;
/** A date or a time: 2026-10-24 · 2026-10-24 23:48 · 2026-10-24T23:19:04Z · 24/10/2026 · 24 Oct 2026 · 23:48. */
const DATE =
  /^(\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?Z?)?|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2} [A-Z][a-z]{2,8} \d{4}|\d{1,2}:\d{2}(:\d{2})?)$/;
/** A cell this long, in this many words, reads as prose: its column wraps at a
 * readable width. A long file name or code has no spaces to wrap at, so it is
 * not prose and keeps its own width. */
const LONG_TEXT = 48;
const LONG_WORDS = 8;
const isProse = (text: string) => text.length >= LONG_TEXT && text.split(/\s+/).length >= LONG_WORDS;

function textOf(node: ElementContent | RootContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

const isElement = (node: ElementContent | RootContent, tag?: string): node is Element =>
  node.type === 'element' && (tag === undefined || node.tagName === tag);

function rowsOf(section: Element): Element[] {
  return section.children.filter((child): child is Element => isElement(child, 'tr'));
}

function cellsOf(row: Element): Element[] {
  return row.children.filter((child): child is Element => isElement(child, 'td') || isElement(child, 'th'));
}

function addClass(cell: Element, name: string) {
  const current: unknown = cell.properties.className;
  const list = Array.isArray(current) ? current.map(String) : typeof current === 'string' ? current.split(/\s+/) : [];
  if (!list.includes(name)) cell.properties.className = [...list, name];
}

export function markTableColumns(table: Element) {
  const sections = table.children.filter((child): child is Element => isElement(child));
  const head = sections.filter((section) => section.tagName === 'thead').flatMap(rowsOf);
  const body = sections.filter((section) => section.tagName === 'tbody').flatMap(rowsOf);
  if (body.length === 0) return;
  const width = Math.max(...[...head, ...body].map((row) => cellsOf(row).length));

  for (let column = 0; column < width; column += 1) {
    const cells = body.map((row) => cellsOf(row)[column]).filter((cell): cell is Element => cell !== undefined);
    const texts = cells.map((cell) => textOf(cell).trim()).filter((text) => text.length > 0);
    if (texts.length === 0) continue;
    const columnCells = [...head, ...body].map((row) => cellsOf(row)[column]).filter((cell): cell is Element => cell !== undefined);
    const aligned = columnCells.some((cell) => cell.properties.align !== undefined);
    if (!aligned && texts.every((text) => NUMBER.test(text) || DATE.test(text))) {
      for (const cell of columnCells) addClass(cell, 'v2-cell-num');
    } else if (texts.some(isProse)) {
      for (const cell of columnCells) addClass(cell, 'v2-cell-long');
    } else if (texts.some(hasLongToken)) {
      for (const cell of columnCells) addClass(cell, 'v2-cell-token');
    }
  }
  // Four columns or more rarely fit a phone: on a narrow screen such a table
  // keeps its first column in place while the rest scroll (chat-table.css).
  if (width >= WIDE_COLUMNS) addClass(table, 'v2-table-wide');
  for (const cell of body.flatMap(cellsOf)) breakLongTokens(cell);
}

/** A table this many columns wide keeps its first column in place on a narrow screen. */
const WIDE_COLUMNS = 4;

const hasLongToken = (text: string) => text.split(/\s+/).some((token) => token.length >= LONG_TOKEN);

/** A run with no spaces this long (a file name, a path) gets break points. */
const LONG_TOKEN = 24;
const BREAK_AFTER = /([_./\\-])/;

/**
 * A long file name has no spaces, so a narrow column could only cut it mid
 * letter or let it run on. After each `_ . / - \` in such a run goes an
 * invisible break point (`<wbr>`), so it wraps at its own separators. `<wbr>`
 * adds no text: what Copy table copies is unchanged.
 */
function breakLongTokens(node: Element) {
  const next: ElementContent[] = [];
  for (const child of node.children) {
    if (child.type === 'element') {
      if (child.tagName !== 'code' && child.tagName !== 'a') breakLongTokens(child);
      next.push(child);
      continue;
    }
    if (child.type !== 'text' || !child.value.split(/\s+/).some((token) => token.length >= LONG_TOKEN)) {
      next.push(child);
      continue;
    }
    for (const part of child.value.split(/(\s+)/)) {
      if (part.length < LONG_TOKEN) {
        next.push({ type: 'text', value: part });
        continue;
      }
      for (const piece of part.split(BREAK_AFTER)) {
        if (piece === '') continue;
        next.push({ type: 'text', value: piece });
        if (BREAK_AFTER.test(piece) && piece.length === 1) next.push({ type: 'element', tagName: 'wbr', properties: {}, children: [] });
      }
    }
  }
  node.children = next;
}

function walk(node: Root | Element) {
  for (const child of node.children) {
    if (!isElement(child)) continue;
    if (child.tagName === 'table') markTableColumns(child);
    else walk(child);
  }
}

export function rehypeTableColumns() {
  return (tree: Root) => walk(tree);
}
