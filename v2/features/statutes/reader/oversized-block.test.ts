import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OVERSIZED_BLOCK_ELEMENTS, isOversizedBlock } from './akn';

/* The Investments and Securities Act 2025 froze the iPhone chat (19 October
 * 2026): its s.357, one section of 987 source elements, sat offscreen at an
 * 18rem placeholder, and WebKit laid the whole of it out again each time the
 * chat changed the page's size. A block over the size cap stays laid out. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), 'utf8').replace(/\r\n/g, '\n');

interface Node {
  children: Node[];
}
const leaf = (): Node => ({ children: [] });
/** A root holding `count` elements below it, as a flat list. */
const flat = (count: number): Node => ({ children: Array.from({ length: count }, leaf) });
/** A root holding `count` elements below it, nested one inside the next. */
const chain = (count: number): Node => {
  let node = leaf();
  for (let i = 1; i < count; i += 1) node = { children: [node] };
  return { children: [node] };
};
const asElement = (node: Node) => node as unknown as Pick<Element, 'children'>;

test('the cap is one named number, 400', () => {
  assert.equal(OVERSIZED_BLOCK_ELEMENTS, 400);
});

test('a block is oversized only above the cap, counting every level below it', () => {
  assert.equal(isOversizedBlock(asElement(leaf())), false);
  assert.equal(isOversizedBlock(asElement(flat(110))), false); // CAMA's largest section
  assert.equal(isOversizedBlock(asElement(flat(400))), false);
  assert.equal(isOversizedBlock(asElement(flat(401))), true);
  assert.equal(isOversizedBlock(asElement(flat(987))), true); // ISA s.357
  // Depth counts the same as breadth.
  assert.equal(isOversizedBlock(asElement(chain(400))), false);
  assert.equal(isOversizedBlock(asElement(chain(401))), true);
  // A mix: 100 paragraphs, each with 3 children, is exactly 400 below the
  // root; with 4 children each it is 500.
  const paragraphs = (children: number): Node => ({
    children: Array.from({ length: 100 }, () => ({ children: Array.from({ length: children }, leaf) })),
  });
  assert.equal(isOversizedBlock(asElement(paragraphs(3))), false);
  assert.equal(isOversizedBlock(asElement(paragraphs(4))), true);
});

test('only body blocks are measured, and an oversized one renders without content-visibility', () => {
  const akn = read('akn.ts');
  assert.match(akn, /oversized: block\.kind === 'body' && isOversizedBlock\(block\.element\),/);
  const node = read('AknNode.tsx');
  assert.match(node, /className=\{block\.oversized \? 'akn-block' : 'akn-block akn-cv'\}/);
  // Every other body block keeps the skip.
  assert.match(read('statute-document.css'), /\.v2-statute-doc \.akn-cv \{\s*content-visibility: auto;\s*contain-intrinsic-size: auto 18rem;\s*\}/);
});
