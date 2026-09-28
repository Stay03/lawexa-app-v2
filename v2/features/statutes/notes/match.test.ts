import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTextIndex, locateQuote, type TextPiece } from './match';

const text = (value: string, handle: string): TextPiece<string> => ({ kind: 'text', text: value, handle });
const brk: TextPiece<string> = { kind: 'break' };

test('a quote inside one run of text (Electoral Act 2026, s.47(1))', () => {
  const index = buildTextIndex([text('shall present his permanent voters card for accreditation', 'p1')]);
  assert.deepEqual(locateQuote(index, 'permanent voters card'), {
    start: { handle: 'p1', offset: 18 },
    end: { handle: 'p1', offset: 39 },
  });
});

test('an italic word is zero width: the quote runs across it', () => {
  // "(c)" with an italic c renders as three text nodes; the server reads "(c)".
  const index = buildTextIndex([text('paragraph (', 'a'), text('c', 'i'), text(') of this', 'b')]);
  assert.equal(index.text, 'paragraph (c) of this');
  assert.deepEqual(locateQuote(index, '(c)'), {
    start: { handle: 'a', offset: 10 },
    end: { handle: 'b', offset: 1 },
  });
});

test('a block boundary counts as one space, so lines do not run together', () => {
  const index = buildTextIndex([text('HOLDEN AT', 'l1'), brk, text('Petition No', 'l2')]);
  assert.equal(index.text, 'HOLDEN AT Petition No');
  assert.deepEqual(locateQuote(index, 'AT Petition'), {
    start: { handle: 'l1', offset: 7 },
    end: { handle: 'l2', offset: 8 },
  });
});

test("the exporter's indentation and line breaks collapse to one space", () => {
  const index = buildTextIndex([text('\n            violence or restraint ;\n          ', 'p')]);
  assert.equal(index.text, 'violence or restraint ;');
  assert.ok(locateQuote(index, 'violence  or\nrestraint ;'));
});

test('words that are not there give null, not a guess', () => {
  const index = buildTextIndex([text('by his or herself', 'p')]);
  assert.equal(locateQuote(index, 'by himself'), null);
  assert.equal(locateQuote(index, '   '), null);
});

test('a repeated quote: prefix and suffix choose the occurrence', () => {
  const index = buildTextIndex([text('the Commission shall; and the Commission may', 'p')]);
  const second = locateQuote(index, 'the Commission', { prefix: 'and', suffix: 'may' });
  assert.deepEqual(second?.start, { handle: 'p', offset: 26 });
});

test('a repeated quote: the start offset chooses when there is no context', () => {
  const index = buildTextIndex([text('the Commission shall; and the Commission may', 'p')]);
  assert.deepEqual(locateQuote(index, 'the Commission', { startOffset: 30 })?.start, { handle: 'p', offset: 26 });
});

test('a repeated quote with no hints takes the first, as an imported note means', () => {
  const index = buildTextIndex([text('the Commission shall; and the Commission may', 'p')]);
  assert.deepEqual(locateQuote(index, 'the Commission')?.start, { handle: 'p', offset: 0 });
});
