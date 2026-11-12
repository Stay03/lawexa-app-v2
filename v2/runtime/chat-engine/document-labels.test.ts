import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { MessageAttachment } from '@/types/chat';
import { documentLabel, labelDocuments, labelsSoFar, withServerLabels } from './document-labels';

/* "Document 1, 2…" in redacted chats (Arthur's choice; backend 11fd72e0, 12
 * November 2026): the app draws the label the server will store, by the
 * server's own rule. TEST DATA only. */

const file = (file_id: number, file_name: string, extra: Partial<MessageAttachment> = {}): MessageAttachment => ({
  file_id,
  file_name,
  file_size: 1000 + file_id,
  ...extra,
});
const asked = (...files: MessageAttachment[]) => ({ role: 'user', attachments: files });
const answered = { role: 'assistant' };

test('a redacted chat numbers its files across the whole chat, in the order they were sent', () => {
  assert.equal(documentLabel(3), 'Document 3');
  // A new chat: its first files are Document 1 and 2, with no extension, whatever they were called.
  assert.deepEqual(
    labelDocuments([], [file(11, 'Ada Obi - lease.docx'), file(12, 'scan of ID.pdf')]).map((f) => f.file_name),
    ['Document 1', 'Document 2'],
  );
  // The backend's example: turn 1 sent two, so turn 2's first new file is Document 3.
  const earlier = [asked(file(11, 'Document 1'), file(12, 'Document 2')), answered];
  assert.deepEqual(labelDocuments(earlier, [file(13, 'Contract (final).pdf')]).map((f) => f.file_name), ['Document 3']);
});

test('a file sent again keeps its first label; deleted and expired files still count', () => {
  const earlier = [asked(file(11, 'Document 1')), answered, asked(file(12, 'Document 2'), file(13, 'Document 3')), answered];
  assert.deepEqual(
    labelDocuments(earlier, [file(12, 'tenancy.pdf'), file(14, 'new.pdf'), file(11, 'lease.docx')]).map((f) => f.file_name),
    ['Document 2', 'Document 4', 'Document 1'],
  );
  // A file whose upload has since gone keeps its row's label, so the next number is after it.
  const gone = [asked(file(99, 'Document 5'))];
  assert.equal(labelDocuments(gone, [file(100, 'x.pdf')])[0].file_name, 'Document 6');
  // The same file twice in one question is one document.
  assert.deepEqual(labelDocuments([], [file(1, 'a.pdf'), file(1, 'a.pdf')]).map((f) => f.file_name), ['Document 1', 'Document 1']);
  // Only questions count, and only labels: an answer's file or an older unlabelled name sets no number.
  const mixed = [{ role: 'assistant', attachments: [file(7, 'Document 9')] }, asked(file(8, 'notes.txt'))];
  assert.deepEqual(labelsSoFar(mixed), { byFile: new Map(), highest: 0 });
  // The rest of a file is untouched: its id, size and type go with it.
  assert.deepEqual(labelDocuments([], [file(5, 'brief.pdf', { mime_type: 'application/pdf' })])[0], {
    file_id: 5,
    file_name: 'Document 1',
    file_size: 1005,
    mime_type: 'application/pdf',
  });
});

test('the server’s labels replace the app’s once the send answers', () => {
  const drawn = [file(13, 'Document 3', { mime_type: 'application/pdf' }), file(14, 'Document 4')];
  assert.deepEqual(withServerLabels(drawn, [{ file_id: 13, file_name: 'Document 5', file_size: 2000 }]), [
    { file_id: 13, file_name: 'Document 5', file_size: 2000, mime_type: 'application/pdf' },
    file(14, 'Document 4'),
  ]);
  assert.deepEqual(withServerLabels(drawn, undefined), drawn);
  assert.deepEqual(withServerLabels(drawn, []), drawn);
});

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('a redacted chat’s question is drawn with its labels, the first send too, and corrected by the server’s', () => {
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.match(engine, /const shownAttachments = isRedactedTurnN \? labelDocuments\(state\.messages, attachmentsList\) : attachmentsList;/);
  assert.match(engine, /const optimisticMsg = addUserMessage\(message, shownAttachments, options\.replyTo\);/);
  assert.match(engine, /attachments: shownAttachments\.map\(\(a\) => \(\{/);
  assert.match(engine, /const labelled = response\.data\.user_message_attachments;\s*if \(isRedactedTurnN && labelled && labelled\.length > 0 && shownAttachments\.length > 0\) \{\s*const confirmed = withServerLabels\(shownAttachments, labelled\);/);
  // The file ids sent are the real ones: only the names change.
  assert.match(engine, /file_ids: fileIdsList/);

  const start = read('v2', 'features', 'conversations', 'start-conversation.ts');
  assert.match(start, /const shownAttachments = redacted \? labelDocuments\(\[\], attachments\) : attachments;/);
  assert.match(start, /const sentAttachments = redacted \? withServerLabels\(shownAttachments, response\.data\.user_message_attachments\) : attachments;\s*writeConvInit\(conversationId, \{ msg: displayMessage, exec: executionId, attachments: sentAttachments, redaction \}\);/);
});
