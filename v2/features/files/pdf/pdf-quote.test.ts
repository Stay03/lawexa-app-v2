import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findPdfQuote, indexPdfText, projectQuote } from './pdf-quote';

/* A Radar report's affected passage, found in one PDF page's text layer
 * (Arthur, 3 November 2026). Runs stand for pdf.js's spans; the handle is a
 * label here, a text node on the page. */

const runs = (...texts: string[]) => texts.map((text, i) => ({ text, handle: `run${i}` }));

test('a passage across two lines is found though the layer has no space between them', () => {
  const index = indexPdfText(runs('The lessee shall pay the rent on the', 'first day of each month.'));
  const found = findPdfQuote(index, 'pay the rent on the first day');
  assert.deepEqual(found, { start: { handle: 'run0', offset: 17 }, end: { handle: 'run1', offset: 9 } });
});

test('a word broken at the line end reads whole, and quotes, dashes and case fold', () => {
  const index = indexPdfText(runs('Clause 4 cites the com-', 'mencement date “1 May” — now void.'));
  assert.notEqual(findPdfQuote(index, 'the commencement date "1 May" - now'), null);
  assert.notEqual(findPdfQuote(index, 'THE COMMENCEMENT DATE'), null);
  // A soft hyphen is dropped too.
  assert.notEqual(findPdfQuote(indexPdfText(runs('commence­ment')), 'commencement'), null);
});

test('the end is one past the last character, in its own run', () => {
  const index = indexPdfText(runs('alpha ', 'beta'));
  assert.deepEqual(findPdfQuote(index, 'alpha beta'), { start: { handle: 'run0', offset: 0 }, end: { handle: 'run1', offset: 4 } });
});

test('a passage the page does not have, or one too short to place, marks nothing', () => {
  const index = indexPdfText(runs('The lessee shall pay the rent.'));
  assert.equal(findPdfQuote(index, 'the lessor shall pay'), null);
  assert.equal(findPdfQuote(index, 'the'), null);
  assert.equal(findPdfQuote(index, '   '), null);
  assert.equal(projectQuote(' A-b\nC '), 'abc');
});
