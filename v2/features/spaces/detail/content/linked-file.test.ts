import { test } from 'node:test';
import assert from 'node:assert/strict';

import { linkedFileFrame, linkedFileRefusal, parseLinkedFileId } from './linked-file';

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
