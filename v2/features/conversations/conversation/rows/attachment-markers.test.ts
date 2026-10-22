import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withoutAttachmentMarks } from './attachment-markers';

/*
 * A redacted chat with a document attached showed the document's whole text,
 * between raw `<attached_document>` tags, in the user's bubble (Lucy's live
 * check, 22 October 2026): the send answers with the redacted form of the
 * turn, which still carries the document, and the app draws it in place of
 * what was typed. The bubble shows the typed words; the file shows as its
 * chip under it.
 */

const here = dirname(fileURLToPath(import.meta.url));

test('a wrapped document is removed, and the typed words stay', () => {
  const sent = '<attached_document name="lease.docx">\nTENANCY AGREEMENT\nBetween [PERSON_1] and [PERSON_2]…\n</attached_document>\n\nIs clause 4 enforceable?';
  assert.equal(withoutAttachmentMarks(sent, true), 'Is clause 4 enforceable?');
  // Words before the document, and two documents.
  assert.equal(
    withoutAttachmentMarks('Compare these.\n<attached_document name="a.docx">A</attached_document>\n<attached_document name="b.txt">B</attached_document>', true),
    'Compare these.',
  );
});

test('the wrapped form goes even when the row has no files yet', () => {
  assert.equal(withoutAttachmentMarks('<attached_document name="x.docx">body</attached_document>\nWhat now?', false), 'What now?');
});

test('a scan sent as page images: its single tag goes, with or without files on the row', () => {
  const sent = '<attached_document name="scan.pdf" pages_as_images="3" />\n\nWhat does page 2 say?';
  assert.equal(withoutAttachmentMarks(sent, true), 'What does page 2 say?');
  assert.equal(withoutAttachmentMarks(sent, false), 'What does page 2 say?');
  assert.equal(withoutAttachmentMarks('Scan <attached_document name="scan.pdf" pages_as_images="1"/>', true), 'Scan');
  // Next to a wrapped document, each goes whole and the words between stay.
  assert.equal(
    withoutAttachmentMarks('<attached_document name="scan.pdf" pages_as_images="2" />\nCompare.\n<attached_document name="a.docx">A</attached_document>', true),
    'Compare.',
  );
});

test('the picture marker goes only on a message with files', () => {
  assert.equal(withoutAttachmentMarks('Read this <attached_image name="a1.png" />', true), 'Read this');
  assert.equal(withoutAttachmentMarks('Read this <attached_image name="a1.png" />', false), 'Read this <attached_image name="a1.png" />');
});

test('a message with no marks is left exactly as typed', () => {
  const typed = '  indented\n\nline two  ';
  assert.equal(withoutAttachmentMarks(typed, true), typed);
});

test('the bubble draws the text through it', () => {
  const row = readFileSync(join(here, 'UserMessageRow.tsx'), 'utf8');
  assert.match(row, /const displayContent = stripContextTags\(withoutAttachmentMarks\(message\.content, hasFiles\)\);/);
  assert.doesNotMatch(row, /ATTACHMENT_MARKER/);
});
