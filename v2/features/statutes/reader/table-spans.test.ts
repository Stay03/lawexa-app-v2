import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tableCellSpans } from '@/lib/utils/table-spans';

/** A cell as the readers see it: anything with getAttribute. */
const cell = (attrs: Record<string, string>) => ({ getAttribute: (name: string) => attrs[name] ?? null });

test('a merged header keeps its spans: rowspan 2 and colspan 3', () => {
  assert.deepEqual(tableCellSpans(cell({ rowspan: '2' })), { rowSpan: 2 });
  assert.deepEqual(tableCellSpans(cell({ colspan: '3' })), { colSpan: 3 });
  assert.deepEqual(tableCellSpans(cell({ rowspan: '2', colspan: '7' })), { rowSpan: 2, colSpan: 7 });
});

test('a plain cell gets no span attributes', () => {
  assert.deepEqual(tableCellSpans(cell({})), {});
  assert.deepEqual(tableCellSpans(cell({ colspan: '1', rowspan: '1' })), {});
});

test('a broken value is ignored, as the browser would ignore it', () => {
  for (const value of ['0', '-2', 'abc', '2.5', '', '  ']) {
    assert.deepEqual(tableCellSpans(cell({ colspan: value, rowspan: value })), {}, JSON.stringify(value));
  }
  assert.deepEqual(tableCellSpans(cell({ colspan: ' 4 ' })), { colSpan: 4 });
});

test('a huge value is capped at HTML\'s own limits', () => {
  assert.deepEqual(tableCellSpans(cell({ colspan: '999999', rowspan: '999999' })), { colSpan: 1000, rowSpan: 65534 });
});

/**
 * Both readers must spread the spans onto every th and td. Read from source:
 * the readers are .tsx client components, which this runner does not load.
 * Without the fix, each of these four lines is missing and the test fails.
 */
test('both statute readers put the spans on their th and td', () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  const v2 = read('v2/features/statutes/reader/AknNode.tsx');
  const v1 = read('components/statutes-v2/AknElementRenderer.tsx');
  assert.match(v2, /<th key=\{index\} \{\.\.\.tableCellSpans\(child\)\}>/);
  assert.match(v2, /<td key=\{index\} \{\.\.\.tableCellSpans\(child\)\}>/);
  assert.match(v1, /<th \{\.\.\.tableCellSpans\(element\)\} dangerouslySetInnerHTML/);
  assert.match(v1, /<td \{\.\.\.tableCellSpans\(element\)\} dangerouslySetInnerHTML/);
});
