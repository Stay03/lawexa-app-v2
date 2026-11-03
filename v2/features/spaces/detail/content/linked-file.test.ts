import { test } from 'node:test';
import assert from 'node:assert/strict';

import { linkedFileFrame, linkedFileRefusal, linkedPassages, parseLinkedFile, parseLinkedFileId } from './linked-file';

/* A link that names a space's file opens that file, not only the Files tab
 * (Arthur, 3 November 2026, on a Radar report's affected file). */

test('the link names a file by its whole positive number, and nothing else counts', () => {
  assert.equal(parseLinkedFileId('7'), 7);
  assert.equal(parseLinkedFileId('120934'), 120934);
  for (const raw of [null, undefined, '', '0', '-3', '7.5', '07', ' 7', 'abc', '7abc', '99999999999999999999']) {
    assert.equal(parseLinkedFileId(raw), null, String(raw));
  }
});

test('a linked file opens where a tap on its row would open it', () => {
  assert.equal(linkedFileFrame({ id: 1, original_name: 'KELVIN ETHICS.pdf', mime_type: 'application/pdf' }), 'pdf');
  // A PDF stored with a generic type is still read by its name.
  assert.equal(linkedFileFrame({ id: 2, original_name: 'lease.pdf', mime_type: 'application/octet-stream' }), 'pdf');
  assert.equal(linkedFileFrame({ id: 3, original_name: 'site.png', mime_type: 'image/png' }), 'gallery');
  assert.equal(linkedFileFrame({ id: 4, original_name: 'hearing.mp4', mime_type: 'video/mp4' }), 'gallery');
  assert.equal(linkedFileFrame({ id: 5, original_name: 'memo.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'card');
  // No type sent: the card, never a guess from the name alone.
  assert.equal(linkedFileFrame({ id: 6, original_name: 'notes.pdf' }), 'card');
});

test('a removed or closed-off file says it is not available; other failures ask for another try', () => {
  assert.match(linkedFileRefusal(404), /isn’t available/);
  assert.match(linkedFileRefusal(403), /isn’t available/);
  assert.match(linkedFileRefusal(500), /try the link again/);
  assert.match(linkedFileRefusal(0), /try the link again/);
});

const AFFECTED = '3f1c2b9a-8d7e-4c6b-9a5f-1e2d3c4b5a69';

test('a Radar link names the page and the affected item; the passage never rides in the address', () => {
  assert.deepEqual(parseLinkedFile({ file: '7', page: '12', affected: AFFECTED }), { fileId: 7, page: 12, affected: AFFECTED });
  assert.deepEqual(parseLinkedFile({ file: '7', page: null, affected: null }), { fileId: 7, page: null, affected: null });
  // A bad page or affected id is dropped; the file still opens.
  assert.deepEqual(parseLinkedFile({ file: '7', page: 'two', affected: 'not-a-uuid' }), { fileId: 7, page: null, affected: null });
  assert.equal(parseLinkedFile({ file: null, page: '12', affected: AFFECTED }), null);
});

test('the affected read gives the page and the passage, for this file only', () => {
  const link = { fileId: 7, page: 12 };
  const one = (page: number, quote: string | null) => ({ passages: [{ page, quote }], start: 0 });
  // In, from a server before the list: its page and its passage.
  assert.deepEqual(linkedPassages(link, { file_id: 7, page: 12, quote: ' Clause 4 cites the old date. ' }), one(12, 'Clause 4 cites the old date.'));
  // Not in yet, or 404: the link's page, no mark.
  assert.deepEqual(linkedPassages(link, null), one(12, null));
  // The server could not place the quote: the page, no mark.
  assert.deepEqual(linkedPassages(link, { file_id: 7, page: 12, quote: null }), one(12, null));
  // The page was not real: the link's page, no mark.
  assert.deepEqual(linkedPassages(link, { file_id: 7, page: null, quote: null }), one(12, null));
  // About another file: ignored.
  assert.deepEqual(linkedPassages(link, { file_id: 8, page: 3, quote: 'elsewhere' }), one(12, null));
  // No page anywhere: nothing to step through.
  assert.deepEqual(linkedPassages({ fileId: 7, page: null }, null), { passages: [], start: 0 });
});

test('a file named for several passages opens on the clicked one, with every passage in order (option 2)', () => {
  const link = { fileId: 7, page: 8 };
  const passages = [
    { page: 3, quote: 'Clause 4 cites the old date.' },
    { page: 8, quote: 'Clause 9 repeats it.' },
    { page: 11, quote: null },
  ];
  assert.deepEqual(linkedPassages(link, { file_id: 7, page: 8, quote: 'Clause 9 repeats it.', passages }), { passages, start: 1 });
  // The clicked one not found in the list: the first.
  assert.deepEqual(linkedPassages(link, { file_id: 7, page: 5, quote: 'gone', passages }).start, 0);
  // A list entry with no real page is left out.
  assert.deepEqual(
    linkedPassages(link, { file_id: 7, page: 3, quote: 'a', passages: [{ page: 0, quote: 'x' }, { page: 3, quote: 'a' }] }),
    { passages: [{ page: 3, quote: 'a' }], start: 0 },
  );
  // An empty list falls back to the item's own page.
  assert.deepEqual(linkedPassages(link, { file_id: 7, page: 8, quote: 'b', passages: [] }), { passages: [{ page: 8, quote: 'b' }], start: 0 });
});
