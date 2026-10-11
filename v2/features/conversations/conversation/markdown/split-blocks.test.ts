import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitMarkdownBlocks } from './split-blocks';

test('blank lines split blocks; runs of blank lines give no empty block', () => {
  assert.deepEqual(splitMarkdownBlocks('One\nstill one\n\nTwo\n\n\n\nThree'), ['One\nstill one', 'Two', 'Three']);
  assert.deepEqual(splitMarkdownBlocks('A\n   \nB'), ['A', 'B']);
});

test('a backtick fence and a tilde fence each stay one block', () => {
  const text = ['Intro', '', '```python', 'x = 1', '```', '', '~~~', 'NOTICE', '~~~', '', 'End'].join('\n');
  assert.deepEqual(splitMarkdownBlocks(text), ['Intro', '```python\nx = 1\n```', '~~~\nNOTICE\n~~~', 'End']);
});

test('a fence holding blank lines is not split, and the other marker does not close it', () => {
  const text = ['```', 'IN THE HIGH COURT', '', '~~~', '', 'Suit No: ____', '```', '', 'After'].join('\n');
  assert.deepEqual(splitMarkdownBlocks(text), [
    '```\nIN THE HIGH COURT\n\n~~~\n\nSuit No: ____\n```',
    'After',
  ]);
});

test('a table is one block', () => {
  const text = ['| Case | Year |', '| --- | --- |', '| Ojukwu | 1986 |', '', 'Next'].join('\n');
  assert.deepEqual(splitMarkdownBlocks(text), ['| Case | Year |\n| --- | --- |\n| Ojukwu | 1986 |', 'Next']);
});

test('CRLF text splits on its blank lines too', () => {
  assert.deepEqual(splitMarkdownBlocks('One\r\n\r\nTwo\r\n```\r\nA\r\n\r\nB\r\n```'), [
    'One\r',
    'Two\r\n```\r\nA\r\n\r\nB\r\n```',
  ]);
});

test('empty text is one empty block', () => {
  assert.deepEqual(splitMarkdownBlocks(''), ['']);
});
