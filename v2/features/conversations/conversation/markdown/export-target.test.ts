import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockIndexOf, fencedBlockTexts, savedMessageId } from './export-target';
import { documentTitle, isLongDocument, FOLD_AFTER_CHARS, FOLD_AFTER_LINES } from './document-view';
import { exportErrorMessage } from './download-docx';
import { filenameFromDisposition, DOCX_FALLBACK_NAME } from '@/lib/api/export';

test('every fenced block counts from 0, code fences included', () => {
  const answer = [
    'Here is the form.',
    '',
    '```',
    'IN THE HIGH COURT OF LAGOS STATE',
    'Suit No: ____',
    '```',
    '',
    'And the script that fills it:',
    '',
    '```python',
    'print("x")',
    '```',
    '',
    '~~~md',
    'NOTICE OF APPEAL',
    '~~~',
  ].join('\n');
  const blocks = fencedBlockTexts(answer);
  assert.deepEqual(blocks, ['IN THE HIGH COURT OF LAGOS STATE\nSuit No: ____', 'print("x")', 'NOTICE OF APPEAL']);
  assert.equal(blockIndexOf(blocks, 'NOTICE OF APPEAL'), 2);
});

test('indented code is not a fenced block; a fence inside a list item is', () => {
  const answer = ['    indented code', '', '1. Draft:', '', '   ```', '   LETTER OF DEMAND', '   ```'].join('\n');
  assert.deepEqual(fencedBlockTexts(answer), ['LETTER OF DEMAND']);
});

test('a fence opened with more backticks holds a shorter one', () => {
  const answer = ['````', 'Use ``` to start code.', '````', '', '```', 'second', '```'].join('\n');
  assert.deepEqual(fencedBlockTexts(answer), ['Use ``` to start code.', 'second']);
});

test('an unclosed fence runs to the end and still counts', () => {
  assert.deepEqual(fencedBlockTexts('Start\n\n```\nAFFIDAVIT\nI, the deponent'), ['AFFIDAVIT\nI, the deponent']);
});

test('the same text twice gives the first index; text not in the message gives none', () => {
  const blocks = fencedBlockTexts('```\nA\n```\n\n```\nA\n```');
  assert.equal(blockIndexOf(blocks, 'A'), 0);
  assert.equal(blockIndexOf(blocks, 'B'), null);
});

test('only a server row id is a saved message id', () => {
  assert.equal(savedMessageId('msg_4182'), 4182);
  assert.equal(savedMessageId('local_1759870000000_ab12'), null);
  assert.equal(savedMessageId('msg_1759870000000_ab12'), null);
  assert.equal(savedMessageId('msg_'), null);
});

test('the title is the first non-empty line, spaces collapsed', () => {
  assert.equal(documentTitle('\n\n   IN THE   HIGH COURT  \nbody'), 'IN THE HIGH COURT');
  assert.equal(documentTitle('\n  \n'), '');
});

test('a document folds past the line or character limit', () => {
  assert.equal(isLongDocument('a\n'.repeat(FOLD_AFTER_LINES - 1)), false);
  assert.equal(isLongDocument('a\n'.repeat(FOLD_AFTER_LINES + 1)), true);
  assert.equal(isLongDocument('a'.repeat(FOLD_AFTER_CHARS + 1)), true);
});

test('each failure status the route returns has its own message', () => {
  assert.match(exportErrorMessage(401), /Sign in/);
  assert.match(exportErrorMessage(404), /no longer available/);
  assert.match(exportErrorMessage(429), /Too many downloads/);
  assert.equal(exportErrorMessage(422), exportErrorMessage(undefined));
  assert.equal(exportErrorMessage(500), 'The download failed. Try again.');
});

test('the file name comes from Content-Disposition, else the fallback', () => {
  assert.equal(filenameFromDisposition('attachment; filename="in-the-high-court.docx"'), 'in-the-high-court.docx');
  assert.equal(
    filenameFromDisposition("attachment; filename=\"x.docx\"; filename*=UTF-8''notice%20of%20appeal.docx"),
    'notice of appeal.docx',
  );
  assert.equal(filenameFromDisposition(undefined), DOCX_FALLBACK_NAME);
  assert.equal(filenameFromDisposition("attachment; filename*=UTF-8''%E0%A4%A"), DOCX_FALLBACK_NAME);
});

test('the export posts only the block number to the saved message route', async () => {
  const { apiClient } = await import('@/lib/api/client');
  const { exportApi } = await import('@/lib/api/export');
  const calls: unknown[][] = [];
  const original = apiClient.post;
  apiClient.post = (async (...args: unknown[]) => {
    calls.push(args);
    return { data: new Blob(['docx']), headers: { 'content-disposition': 'attachment; filename="notice.docx"' } };
  }) as typeof apiClient.post;
  try {
    const file = await exportApi.messageBlockDocx({ conversationId: 'db45bccb-0000', messageId: 4182, block: 2 });
    assert.equal(file.filename, 'notice.docx');
    assert.deepEqual(calls, [
      ['/conversations/db45bccb-0000/messages/4182/export-docx', { block: 2 }, { responseType: 'blob' }],
    ]);
  } finally {
    apiClient.post = original;
  }
});
