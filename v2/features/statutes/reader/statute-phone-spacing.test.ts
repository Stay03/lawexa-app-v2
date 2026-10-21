import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Tester, 20 October 2026 (finding 11): on a phone the statute reader's 28 px
 * step between provisions read as large gaps between paragraphs. */

const css = readFileSync(join(process.cwd(), 'v2', 'features', 'statutes', 'reader', 'statute-document.css'), 'utf8').replace(/\r\n/g, '\n');

test('a phone steps 18 px between provisions, a computer 28 px', () => {
  assert.match(css, /\.v2-statute-doc \.akn-block \+ \.akn-block \{\s*margin-top: 1\.125rem;/);
  assert.match(
    css,
    /@media \(min-width: 768px\) \{\s*\.v2-statute-doc \.akn-block \+ \.akn-block,[^{]*\.akn-section \+ \.akn-anchor > :first-child \{\s*margin-top: 1\.75rem;/,
  );
});

test('a numbered provision sits 8 px apart on a phone and 10 px on a computer', () => {
  assert.match(css, /\.v2-statute-doc \.akn-numbered \{[^}]*margin: 0\.5rem 0;/);
  assert.match(css, /@media \(min-width: 768px\) \{\s*\.v2-statute-doc \.akn-numbered,\s*\.v2-statute-doc \.akn-unnumbered \{\s*margin: 0\.625rem 0;/);
});
